import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** Native flat config from eslint-config-next (avoids FlatCompat circular JSON on validate). */
const eslintConfig = [...nextVitals, ...nextTs];

export default eslintConfig;
