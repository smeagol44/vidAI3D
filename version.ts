import packageJson from './package.json' with { type: 'json' };

/** The displayed release version comes from the same package metadata as npm. */
export const VIDA_VERSION = 'v' + packageJson.version;
export const VIDA_CREDITS = 'by Hernán Garro and Federico Regueira';
