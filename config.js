/* global module */

let config = {
  "notGetBlocks": [
    "blocks-demo.html"
  ],
  "ignoredBlocks": [
    "no-js"
  ],
  "alwaysAddBlocks": [],
  "addStyleBefore": [
    "sanitize.css/sanitize.css",
    "sanitize.css/forms.css",
    "sanitize.css/assets.css",
    "sanitize.css/typography.css",
    "sanitize.css/reduce-motion.css",
    "src/scss/variables.scss",
    "src/scss/reboot.scss",
    "src/scss/mixins.scss",
    "src/scss/typography.scss",
    "src/scss/vendor.scss",
    "src/scss/fonts.scss",
    "src/scss/animations.scss"
    // "somePackage/dist/somePackage.css" // для 'node_modules/somePackage/dist/somePackage.css',
  ],
  "addStyleAfter": [],
  "addJsBefore": [
    // "somePackage/dist/somePackage.js" // для 'node_modules/somePackage/dist/somePackage.js',
  ],
  "addJsAfter": [
    "./script.js"
  ],
  'addAdditions': {
    'src/favicon/*.{png,ico,svg,xml,webmanifest}': 'img/favicon'
  },
  "dir": {
    "src": "src/",
    "data": "src/data/",
    "build": "build/",
    "blocks": "src/blocks/",
    "svgAsBg": "src/symbols/svgAsBg.xml"
  }
};

export default config;
