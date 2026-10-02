import localFont from "next/font/local";

// Bundled (latin subset) so builds don't depend on reaching Google Fonts.
export const dm_sans = localFont({
  src: "./fonts/dm-sans-variable.woff2",
  weight: "100 900",
  display: "swap",
});
export const poppins = localFont({
  src: [
    { path: "./fonts/poppins-100.woff2", weight: "100" },
    { path: "./fonts/poppins-300.woff2", weight: "300" },
    { path: "./fonts/poppins-400.woff2", weight: "400" },
    { path: "./fonts/poppins-500.woff2", weight: "500" },
    { path: "./fonts/poppins-700.woff2", weight: "700" },
    { path: "./fonts/poppins-900.woff2", weight: "900" },
  ],
  display: "swap",
});
