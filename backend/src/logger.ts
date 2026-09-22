export type LogFields = Record<string, string | number | boolean | null>;

export type Logger = {
  info: (fields: LogFields) => void;
  error: (fields: LogFields) => void;
};

function write(level: string, fields: LogFields): void {
  const line = JSON.stringify({ level, time: new Date().toISOString(), ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export function createLogger(level = "info"): Logger {
  const enabled = level !== "silent";
  return {
    info(fields) {
      if (enabled) write("info", fields);
    },
    error(fields) {
      if (enabled) write("error", fields);
    },
  };
}

export const silentLogger: Logger = { info() {}, error() {} };
