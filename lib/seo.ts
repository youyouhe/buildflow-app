import { Metadata } from "next";

interface SEOParams {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
  canonical?: string;
}

export function generateSEO({
  title = "buildflow | Build with AI ✨",
  description = "buildflow is a web development tool that helps you build websites with AI, no code required. Let's deploy your website with buildflow and enjoy the magic of AI.",
  path = "",
  image = "/banner.png",
  noIndex = false,
  canonical,
}: SEOParams = {}): Metadata {
  const baseUrl = "https://buildflow.vercel.app";
  const fullUrl = `${baseUrl}${path}`;
  const canonicalUrl = canonical || fullUrl;
  
  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: noIndex 
      ? { 
          index: false, 
          follow: false,
          googleBot: {
            index: false,
            follow: false,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          }
        }
      : {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          }
        },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "buildflow",
      images: [
        {
          url: `${baseUrl}${image}`,
          width: 1200,
          height: 630,
          alt: `${title} - buildflow`,
        },
      ],
      locale: "en_US",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${baseUrl}${image}`],
      creator: "@buildflow",
    },
    other: {
      // Control how the page appears when shared
      'og:image:secure_url': `${baseUrl}${image}`,
      // Help search engines understand the primary URL
      'rel': 'canonical',
    },
  };
}

export function generateStructuredData(type: 'WebApplication' | 'Organization' | 'Article', data: any) {
  const baseStructuredData = {
    '@context': 'https://schema.org',
    '@type': type,
  };

  switch (type) {
    case 'WebApplication':
      return {
        ...baseStructuredData,
        name: 'buildflow',
        description: 'Build websites with AI, no code required',
        url: 'https://buildflow.vercel.app',
        applicationCategory: 'DeveloperApplication',
        operatingSystem: 'Web',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
        creator: {
          '@type': 'Organization',
          name: 'buildflow',
          url: 'https://buildflow.vercel.app',
        },
        ...data,
      };
    
    case 'Organization':
      return {
        ...baseStructuredData,
        name: 'buildflow',
        url: 'https://buildflow.vercel.app',
        logo: 'https://buildflow.vercel.app/logo.svg',
        description: 'AI-powered web development platform',
        sameAs: [
          // Add social media links here if available
        ],
        ...data,
      };
    
    default:
      return { ...baseStructuredData, ...data };
  }
}
