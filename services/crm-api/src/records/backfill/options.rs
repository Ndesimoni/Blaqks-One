//! Command-line options for `media-backfill`.

pub const USAGE: &str = "Usage: media-backfill [--workspace <id>] [--apply]";

#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Options {
    /// Move the files; without it the command only reports (dry run).
    pub apply: bool,
    /// Only this workspace; every workspace otherwise.
    pub workspace: Option<String>,
}

impl Options {
    pub fn parse(args: &[String]) -> Result<Self, String> {
        let mut options = Self::default();
        let mut args = args.iter();
        while let Some(arg) = args.next() {
            match arg.as_str() {
                "--apply" => options.apply = true,
                "--workspace" if options.workspace.is_none() => {
                    let id = args
                        .next()
                        .map(|id| id.trim())
                        .filter(|id| !id.is_empty() && !id.starts_with("--") && id.len() <= 128)
                        .ok_or_else(|| format!("--workspace needs a workspace ID. {USAGE}"))?;
                    options.workspace = Some(id.to_owned());
                }
                _ => return Err(format!("Unknown option {arg}. {USAGE}")),
            }
        }
        Ok(options)
    }
}

/// The options when `command` is `media-backfill`; `None` for any other command.
pub fn requested(command: Option<&str>, args: &[String]) -> Result<Option<Options>, String> {
    match command {
        Some("media-backfill") => Options::parse(args).map(Some),
        _ => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(values: &[&str]) -> Result<Options, String> {
        let args: Vec<String> = values.iter().map(|value| value.to_string()).collect();
        Options::parse(&args)
    }

    #[test]
    fn dry_run_is_the_default_and_unknown_options_are_refused() {
        assert_eq!(parse(&[]).unwrap(), Options::default());
        let both = parse(&["--workspace", "team-1", "--apply"]).unwrap();
        assert!(both.apply);
        assert_eq!(both.workspace.as_deref(), Some("team-1"));
        assert!(parse(&["--apply"]).unwrap().workspace.is_none());
        for bad in [
            &["--workspace"][..],
            &["--workspace", "--apply"],
            &["--workspace", " "],
            &["--workspace", "a", "--workspace", "b"],
            &["--force"],
            &["apply"],
        ] {
            assert!(parse(bad).is_err(), "{bad:?}");
        }
        assert_eq!(requested(Some("migrate"), &[]), Ok(None));
        assert_eq!(
            requested(Some("media-backfill"), &[]),
            Ok(Some(Options::default()))
        );
    }
}
