/**
 * Fractal Office desktop packaging. This local-only fork intentionally has no
 * hosted update feed and bundles no third-party AI command-line service.
 */

/** @type {import('electron-builder').Configuration} */
const appleNotarization = process.env.APPLE_KEYCHAIN_PROFILE
  ? { keychainProfile: process.env.APPLE_KEYCHAIN_PROFILE }
  : process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID
    ? true
    : false

const config = {
  appId: 'com.fractal.office',
  productName: 'Fractal Office',
  electronVersion: '41.7.1',
  directories: {
    output: 'release',
  },
  files: ['out/**'],
  extraResources: [
    {
      from: 'build/THIRD-PARTY-NOTICES.txt',
      to: 'THIRD-PARTY-NOTICES.txt',
    },
    {
      from: '../../node_modules/electron/dist/LICENSES.chromium.html',
      to: 'LICENSES.chromium.html',
    },
    {
      from: '../docs/out',
      to: 'modules/docs',
    },
    {
      from: '../sheets/out',
      to: 'modules/sheets',
    },
    {
      from: '../slides/out',
      to: 'modules/slides',
    },
    {
      from: '../pdf/out',
      to: 'modules/pdf',
    },
  ],
  fileAssociations: [
    {
      ext: 'docx',
      name: 'Word Document',
      role: 'Editor',
    },
    {
      ext: 'xlsx',
      name: 'Excel Workbook',
      role: 'Editor',
    },
    {
      ext: 'pptx',
      name: 'PowerPoint Presentation',
      role: 'Editor',
    },
    {
      ext: 'xls',
      name: 'Excel 97-2003 Workbook',
      role: 'Editor',
    },
    {
      ext: 'csv',
      name: 'CSV Document',
      role: 'Editor',
    },
    {
      ext: 'pdf',
      name: 'PDF Document',
      role: 'Editor',
    },
  ],
  npmRebuild: false,
  mac: {
    target: ['dmg', 'zip'],
    artifactName: 'Fractal-Office-${version}-${arch}.${ext}',
    category: 'public.app-category.productivity',
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    notarize: appleNotarization,
    extraResources: [
      {
        from: '../sheets/native/xlsx-engine/target/release/xlsx-sidecar',
        to: 'native/xlsx-sidecar',
      },
    ],
  },
  win: {
    artifactName: 'Fractal-Office-Setup-${version}-${arch}.${ext}',
    target: [
      {
        target: 'nsis',
        arch: ['x64'],
      },
    ],
    extraResources: [
      {
        // The Windows runner builds Rust's native MSVC target into target/release.
        // Keeping this path native also makes `npm run dist:win` work locally.
        from: '../sheets/native/xlsx-engine/target/release/xlsx-sidecar.exe',
        to: 'native/xlsx-sidecar.exe',
      },
    ],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
  dmg: {
    sign: false,
  },
  afterAllArtifactBuild: 'build/notarize-dmg.js',
}

module.exports = config
