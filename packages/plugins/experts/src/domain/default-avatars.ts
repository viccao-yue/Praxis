import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExpertDefinition } from 'workdsh-contracts';

/** File names under resources/avatars/, keyed by default expert id (catalog order). */
const DEFAULT_AVATAR_FILES = {
  'changqingyun-container-advisor': 'kubercon.png',
  'requirement-analysis-advisor': 'requirement.png',
  'document-review-advisor': 'document.png',
  'work-retrospective-advisor': 'retrospective.png',
} as const;

const avatarsRoot = join(dirname(fileURLToPath(import.meta.url)), '../../resources/avatars');

export type DefaultAvatarBundle = {
  readonly avatarRef: string;
  readonly packageAssets: NonNullable<ExpertDefinition['packageAssets']>;
};

/** Load a shipped default avatar as package asset + data-URL projection for list/detail UI. */
export function loadDefaultAvatar(expertId: string): DefaultAvatarBundle | undefined {
  const fileName = DEFAULT_AVATAR_FILES[expertId as keyof typeof DEFAULT_AVATAR_FILES];
  if (!fileName) return undefined;
  const bytes = readFileSync(join(avatarsRoot, fileName));
  const base64 = bytes.toString('base64');
  return {
    avatarRef: `data:image/png;base64,${base64}`,
    packageAssets: { 'avatars/expert.png': { base64 } },
  };
}

/** Merge shipped avatar into a default template definition when the file is present. */
export function withDefaultAvatar(expertId: string, definition: ExpertDefinition): ExpertDefinition {
  const avatar = loadDefaultAvatar(expertId);
  if (!avatar) return definition;
  return {
    ...definition,
    avatarRef: avatar.avatarRef,
    packageAssets: { ...definition.packageAssets, ...avatar.packageAssets },
  };
}
