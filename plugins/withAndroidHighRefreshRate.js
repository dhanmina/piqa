const { withMainActivity } = require('expo/config-plugins');

const BEGIN = '// @generated begin high-refresh-rate - piqa (DO NOT MODIFY)';
const END = '// @generated end high-refresh-rate';

// Kotlin snippet: on each resume, ask the OS for the display mode with the
// highest refresh rate at the current resolution. Android defaults many
// devices to 60Hz even on 90/120Hz panels, so we opt in explicitly.
const SNIPPET = `${BEGIN}
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
      val piqaDisplay =
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) display
        else @Suppress("DEPRECATION") windowManager.defaultDisplay
      val piqaCurrent = piqaDisplay?.mode
      val piqaBest = piqaDisplay?.supportedModes
        ?.filter {
          piqaCurrent == null ||
            (it.physicalWidth == piqaCurrent.physicalWidth &&
              it.physicalHeight == piqaCurrent.physicalHeight)
        }
        ?.maxByOrNull { it.refreshRate }
      if (piqaBest != null) {
        val piqaParams = window.attributes
        piqaParams.preferredDisplayModeId = piqaBest.modeId
        window.attributes = piqaParams
      }
    }
    ${END}`;

/**
 * Injects a high-refresh-rate request into MainActivity.onCreate so the app
 * runs at 90/120Hz on capable Android displays instead of the 60Hz default.
 */
module.exports = function withAndroidHighRefreshRate(config) {
  return withMainActivity(config, (config) => {
    let contents = config.modResults.contents;

    if (config.modResults.language !== 'kt') {
      throw new Error(
        'withAndroidHighRefreshRate expects a Kotlin MainActivity (.kt).'
      );
    }

    // Idempotent: strip any previously generated block before re-inserting.
    const existing = new RegExp(`\\n?\\s*${escapeRegExp(BEGIN)}[\\s\\S]*?${escapeRegExp(END)}`);
    contents = contents.replace(existing, '');

    // Anchor after `super.onCreate(null)` inside onCreate().
    const anchor = 'super.onCreate(null)';
    if (!contents.includes(anchor)) {
      throw new Error(
        `withAndroidHighRefreshRate: could not find "${anchor}" in MainActivity.`
      );
    }

    contents = contents.replace(anchor, `${anchor}\n    ${SNIPPET}`);
    config.modResults.contents = contents;
    return config;
  });
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
