//! Command-line options for `seed-sample` and `clear-sample`.

pub const USAGE: &str = "Usage: seed-sample [--no-staff] [--organisation] [--yes] | \
     clear-sample [--organisation] [--include-edited] [--yes] | \
     seed-platform-sample [--no-staff] [--yes] | clear-platform-sample [--yes]";

/// Every sample command name, for the binary's dispatch.
pub const COMMANDS: [&str; 4] = [
    "seed-sample",
    "clear-sample",
    "seed-platform-sample",
    "clear-platform-sample",
];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Command {
    Seed,
    Clear,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Options {
    pub command: Command,
    /// Seed only: create or reactivate the three sample staff accounts (default on).
    pub staff: bool,
    /// Names Blaqks One's organisation workspace, which holds no CRM records (BO1a), so
    /// the command refuses it; kept so the old flag explains itself.
    pub organisation: bool,
    /// Skip the confirmation prompt; required when standard input is not a terminal.
    pub yes: bool,
    /// Clear only: also remove sample records people changed in the app.
    pub include_edited: bool,
    /// Blaqks One's own sample data (`*-platform-sample`), never a company's.
    pub platform: bool,
}

impl Options {
    pub fn parse(command: &str, args: &[String]) -> Result<Self, String> {
        let (command, platform) = match command {
            "seed-sample" => (Command::Seed, false),
            "clear-sample" => (Command::Clear, false),
            "seed-platform-sample" => (Command::Seed, true),
            "clear-platform-sample" => (Command::Clear, true),
            _ => return Err(USAGE.into()),
        };
        let mut options = Self {
            command,
            staff: true,
            organisation: false,
            yes: false,
            include_edited: false,
            platform,
        };
        for arg in args {
            match arg.as_str() {
                "--organisation" | "--organization" if !platform => options.organisation = true,
                "--yes" => options.yes = true,
                "--no-staff" if command == Command::Seed => options.staff = false,
                "--include-edited" if command == Command::Clear && !platform => {
                    options.include_edited = true
                }
                _ => return Err(format!("Unknown option {arg}. {USAGE}")),
            }
        }
        Ok(options)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn parses_flags_per_command_and_refuses_unknown_ones() {
        let seed = Options::parse("seed-sample", &[]).unwrap();
        assert!(seed.staff && !seed.organisation && seed.command == Command::Seed);
        let flags = args(&["--no-staff", "--organisation"]);
        let seed = Options::parse("seed-sample", &flags).unwrap();
        assert!(!seed.staff && seed.organisation);
        let flags = args(&["--organisation", "--include-edited", "--yes"]);
        let clear = Options::parse("clear-sample", &flags).unwrap();
        assert!(clear.organisation && clear.include_edited && clear.yes);
        assert!(!seed.yes && clear.command == Command::Clear);
        assert!(Options::parse("seed-sample", &args(&["--include-edited"])).is_err());
        assert!(Options::parse("clear-sample", &args(&["--no-staff"])).is_err());
        assert!(Options::parse("seed-sample", &args(&["--force"])).is_err());
        assert!(Options::parse("drop-sample", &[]).is_err());
        let platform = Options::parse("seed-platform-sample", &args(&["--no-staff"])).unwrap();
        assert!(platform.platform && !platform.staff && platform.command == Command::Seed);
        assert!(Options::parse("seed-platform-sample", &args(&["--organisation"])).is_err());
        assert!(Options::parse("clear-platform-sample", &args(&["--include-edited"])).is_err());
    }
}
