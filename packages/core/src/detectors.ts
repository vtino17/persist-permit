export interface DetectorHit {
  kind: "credential" | "personal" | "instruction";
  detector: string;
}

const detectors: Array<{ kind: DetectorHit["kind"]; name: string; pattern: RegExp }> = [
  { kind: "credential", name: "private-key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
  { kind: "credential", name: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/u },
  { kind: "credential", name: "aws-access-key", pattern: /\bAKIA[0-9A-Z]{16}\b/u },
  { kind: "credential", name: "bearer-token", pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}\b/iu },
  { kind: "personal", name: "email-address", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu },
  { kind: "personal", name: "phone-number", pattern: /(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?){2,4}\d{3,4}/u },
  { kind: "instruction", name: "instruction-override", pattern: /\bignore (?:all |any )?(?:previous|prior) instructions?\b/iu },
  { kind: "instruction", name: "concealment", pattern: /\b(?:do not|never) (?:tell|show|inform|reveal) (?:the )?user\b/iu },
  { kind: "instruction", name: "delayed-trigger", pattern: /\bwhen (?:the user|asked|you see|triggered)\b.{0,80}\b(?:run|execute|send|upload|delete)\b/iu },
  { kind: "instruction", name: "privileged-prompt", pattern: /\b(?:system prompt|developer message)\b/iu },
];

export const scanContent = (content: string): DetectorHit[] =>
  detectors.filter((detector) => detector.pattern.test(content)).map(({ kind, name }) => ({ kind, detector: name }));
