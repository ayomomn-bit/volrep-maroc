import type { Metadata } from "next";
import { Montserrat, Inter, Playfair_Display } from "next/font/google";
import { PromoBar } from "@/components/layout/PromoBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CartProvider } from "@/components/cart/CartProvider";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { getGlobalShopData } from "@/lib/site/global";
import { t } from "@/lib/i18n";
import "./globals.css";

// Official VOLREP typography: Montserrat Bold for headings, Aeonik Regular
// for body. Aeonik isn't available as a font asset in this project, so per
// brand guidance we fall back to Inter for body text.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Display serif for the product landing page's long-form conversion flow
// (components/product-landing/*). Loaded here because next/font must be
// module-scoped; it is only ever referenced via `--font-playfair` inside
// `.plp` (product-landing.css) and never touches the rest of the site.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: t.metadata.defaultTitle,
    template: t.metadata.titleTemplate,
  },
  description: t.metadata.description,
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const globalData = await getGlobalShopData();

  return (
    <html
      lang="fr"
      className={`${montserrat.variable} ${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <CartProvider>
          <PromoBar />
          <Header data={globalData} />
          <main className="flex-1">{children}</main>
          <Footer data={globalData} />
          <CartDrawer />
        </CartProvider>
      </body>
    </html>
  );
}
