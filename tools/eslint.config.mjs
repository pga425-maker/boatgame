import globals from "globals";
export default [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "script",
      globals: { ...globals.browser, THREE: "readonly" }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": ["warn", { args: "none" }],
      "no-redeclare": "error",
      "no-const-assign": "error",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-unreachable": "warn",
      "no-self-assign": "warn",
      "no-shadow": ["warn", { builtinGlobals: false }],
      "no-use-before-define": ["off"],
      "no-func-assign": "error",
      "no-inner-declarations": "off",
      "use-isnan": "error",
      "valid-typeof": "error",
      "no-cond-assign": "error",
      "no-fallthrough": "warn",
      "eqeqeq": ["warn", "always"]
    }
  }
];
