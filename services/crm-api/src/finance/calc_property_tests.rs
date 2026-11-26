//! The 10k-case property test (finance-design §3.4). Cases come from splitmix64 with
//! the fixture's seed and draw order, so the JS preview can reproduce them exactly and
//! compare the fixture's column sums.
use super::*;
use std::collections::BTreeMap;

struct SplitMix64(u64);

impl SplitMix64 {
    fn next(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }

    fn below(&mut self, bound: u64) -> u64 {
        self.next() % bound
    }
}

fn draw(random: &mut SplitMix64) -> (Terms, Option<i32>) {
    let money = (MAX_FILS as u64) + 1;
    let fixed = random.below(2) == 1;
    let agreed = random.below(money) as i64;
    let rate = random.below(10_001) as i32;
    let fixed_fee = random.below(money) as i64;
    let partner = random.below(10_001) as i32;
    let owner_held = random.below(4) == 0;
    let agreement = random.below(10_001) as i32;
    let has_second = random.below(2) == 1;
    let second = random.below(10_001) as i32;
    let company = random.below(2) == 1;
    let vat = random.below(2) == 1;
    let (share, _) = select_share(owner_held, None, Some(agreement), 0);
    let fee = match fixed {
        true => Fee::Fixed {
            fee_fils: fixed_fee,
        },
        false => Fee::Percentage {
            agreed_value_fils: agreed,
            rate_bp: rate,
        },
    };
    let terms = Terms {
        fee,
        partner_share_bp: partner,
        agent_share_bp: share,
        second_share_bp: has_second.then_some(second),
        second_source: if company {
            SecondSource::Company
        } else {
            SecondSource::FirstAgent
        },
        vat_registered: vat,
    };
    (terms, share)
}

#[test]
fn ten_thousand_random_cases_keep_every_invariant_and_match_the_fixture_sums() {
    let golden = super::tests::fixture();
    let property = &golden["property"];
    let seed = property["seed"].as_u64().unwrap();
    let cases = property["cases"].as_u64().unwrap();
    let mut random = SplitMix64(seed);
    let mut sums: BTreeMap<&str, i128> = BTreeMap::new();
    for _ in 0..cases {
        let (terms, share) = draw(&mut random);
        let result = calculate(&terms).expect("generated inputs are in range");
        assert_eq!(calculate(&terms), Ok(result), "deterministic");
        let lines = result.primary_fils.unwrap_or(0) + result.second_fils.unwrap_or(0);
        assert_eq!(
            result.gross_fils,
            result.partner_fils + result.company_fils + lines,
            "{terms:?}"
        );
        assert!(result.net_fils >= 0 && result.company_fils >= 0 && result.vat_fils >= 0);
        assert_eq!(result.primary_fils.is_some(), share.is_some());
        let received = random.below(2 * result.net_fils as u64 + 1) as i64;
        let share_of = |line: Option<i64>| {
            line.map(|line| received_share(line, received, result.net_fils))
                .unwrap_or(0)
        };
        let (primary, second) = (share_of(result.primary_fils), share_of(result.second_fils));
        assert!(primary + second <= received.min(result.net_fils));
        let add = [
            ("agentShareBp", i64::from(share.unwrap_or(0))),
            ("grossFils", result.gross_fils),
            ("partnerFils", result.partner_fils),
            ("netFils", result.net_fils),
            ("primaryFils", result.primary_fils.unwrap_or(0)),
            ("secondFils", result.second_fils.unwrap_or(0)),
            ("companyFils", result.company_fils),
            ("vatFils", result.vat_fils),
            ("receivedFils", received),
            ("primaryReceivedFils", primary),
            ("secondReceivedFils", second),
            ("outstandingFils", outstanding(result.net_fils, received)),
        ];
        for (key, value) in add {
            *sums.entry(key).or_default() += i128::from(value);
        }
    }
    for (key, want) in property["sums"].as_object().unwrap() {
        assert_eq!(
            sums[key.as_str()].to_string(),
            want.as_str().unwrap(),
            "{key}"
        );
    }
}
