import {
  Space_Grotesk,
  IBM_Plex_Mono,
  IM_Fell_English,
  Uncial_Antiqua,
  Cinzel_Decorative,
  UnifrakturCook,
  Great_Vibes,
  Caveat,
  Playfair_Display
} from "next/font/google";
import "./globals.css";
import "./diary.css";
import ThemeToggle from "@/components/ThemeToggle";
import { AuthProvider } from "@/context/AuthContext";

const headingFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading"
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono"
});

const plumeFont = IM_Fell_English({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-plume"
});

const uncialFont = Uncial_Antiqua({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-uncial"
});

const cinzelDecorativeFont = Cinzel_Decorative({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-cinzel-decorative"
});

const frakturFont = UnifrakturCook({
  subsets: ["latin"],
  weight: ["700"],
  variable: "--font-fraktur"
});

const curvedScriptFont = Great_Vibes({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-curved-script"
});

const caveatFont = Caveat({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-caveat"
});

const playfairFont = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-playfair"
});

export const metadata = {
  title: "SyncNote",
  description: "Realtime collaborative document editor"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${headingFont.variable} ${monoFont.variable} ${plumeFont.variable} ${uncialFont.variable} ${cinzelDecorativeFont.variable} ${frakturFont.variable} ${curvedScriptFont.variable} ${caveatFont.variable} ${playfairFont.variable}`}
      >
        {process.env.NODE_ENV === "development" ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `/* dev-only: guard removeChild to avoid HMR races */(function(){try{var _orig=Node.prototype.removeChild;Node.prototype.removeChild=function(c){try{if(!c||!c.parentNode)return c;}catch(e){return c;}return _orig.call(this,c);};}catch(e){} })();`,
            }}
          />
        ) : null}
        <ThemeToggle showControl={false} />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
