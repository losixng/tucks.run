(function () {
  const siteUrl = 'https://tucks.netlify.app';
  const pagePath = window.location.pathname.replace(/\\/+$|index.html$/i, '') || '/';
  const normalizedPath = pagePath === '' ? '/' : pagePath;

  const pageConfigs = {
    '/': {
      title: "TUCKS – Nigeria's Campus Marketplace for Students | Food, Shopping & Campus Services",
      description: "TUCKS is Nigeria's all-in-one campus marketplace where students can order food, shop from trusted vendors, discover campus deals, and buy or sell safely.",
      keywords: [
        'TUCKS', 'TUCKS Nigeria', 'campus marketplace', 'student marketplace', 'student shopping',
        'student e-commerce', 'campus food delivery', 'student deals', 'trusted campus vendors'
      ],
      type: 'WebSite',
      section: 'Home',
      schema: ['WebSite', 'Organization']
    },
    '/index.html': {
      title: "TUCKS – Nigeria's Campus Marketplace for Students | Food, Shopping & Campus Services",
      description: "TUCKS is Nigeria's all-in-one campus marketplace where students can order food, shop from trusted vendors, discover campus deals, and buy or sell safely.",
      keywords: ['TUCKS', 'campus marketplace', 'student marketplace', 'campus shopping'],
      type: 'WebSite',
      section: 'Home',
      schema: ['WebSite', 'Organization']
    },
    '/home.html': {
      title: "TUCKS – Nigeria's Campus Marketplace for Students | Food, Shopping & Campus Services",
      description: "Shop with confidence in comfort on TUCKS, the trusted student marketplace in Nigeria for food, campus vendors, deals, essentials and student-to-student buying.",
      keywords: ['TUCKS Nigeria', 'student marketplace in Nigeria', 'campus delivery service', 'buy and sell on campus'],
      type: 'WebSite',
      section: 'Marketplace',
      schema: ['WebSite', 'Organization', 'ItemList']
    },
    '/marketplace.html': {
      title: 'Marketplace | TUCKS Nigeria Campus Shopping Platform',
      description: 'Explore TUCKS marketplace for student shopping, campus essentials, trusted vendors, deals and secure campus buying and selling.',
      keywords: ['student marketplace', 'university marketplace', 'campus essentials', 'campus community'],
      type: 'WebSite',
      section: 'Marketplace',
      schema: ['WebSite', 'ItemList']
    },
    '/food.html': {
      title: 'Campus Food Delivery | TUCKS Nigeria',
      description: 'Order food on campus from trusted vendors with fast, simple and secure campus food delivery through TUCKS.',
      keywords: ['campus food delivery', 'order food on campus', 'buy food from campus vendors', 'university food delivery'],
      type: 'WebPage',
      section: 'Food',
      schema: ['WebPage', 'FAQPage']
    },
    '/food_delivery.html': {
      title: 'Campus Food Delivery | TUCKS Nigeria',
      description: 'Place campus food orders quickly and enjoy fast delivery from trusted campus vendors with TUCKS.',
      keywords: ['campus delivery service', 'student food delivery', 'campus vendors'],
      type: 'WebPage',
      section: 'Food',
      schema: ['WebPage', 'FAQPage']
    },
    '/vendor.html': {
      title: 'Campus Vendors | TUCKS Nigeria Trusted Student Business Platform',
      description: 'Discover trusted campus vendors and grow your student business with TUCKS, the campus marketplace built for Nigerian students.',
      keywords: ['campus vendors', 'trusted campus vendors', 'student business platform', 'campus community'],
      type: 'WebPage',
      section: 'Vendors',
      schema: ['WebPage', 'Organization']
    },
    '/vendor-register.html': {
      title: 'Register as a Campus Vendor | TUCKS Nigeria',
      description: 'Join TUCKS as a vendor and reach student customers across campus with secure listings and fast student-friendly discovery.',
      keywords: ['student business platform', 'vendor registration', 'campus marketplace'],
      type: 'WebPage',
      section: 'Vendors',
      schema: ['WebPage', 'Organization']
    },
    '/events.html': {
      title: 'Student Feed & Events | TUCKS Nigeria',
      description: 'Explore campus events, student deals, and community activity with TUCKS student feed designed for Nigerian university life.',
      keywords: ['student feed', 'student deals', 'campus events', 'campus community'],
      type: 'WebPage',
      section: 'Student Feed',
      schema: ['WebPage', 'ItemList']
    },
    '/profile.html': {
      title: 'Student Profile | TUCKS Nigeria',
      description: 'Manage your TUCKS profile, track orders and stay connected to campus shopping and student deals in one place.',
      keywords: ['student profile', 'campus marketplace', 'student shopping'],
      type: 'WebPage',
      section: 'Profile',
      schema: ['WebPage']
    },
    '/wallet.html': {
      title: 'Wallet | TUCKS Nigeria',
      description: 'Manage your TUCKS wallet for secure payments, student purchases and campus marketplace transactions.',
      keywords: ['wallet', 'secure payments', 'student marketplace'],
      type: 'WebPage',
      section: 'Wallet',
      schema: ['WebPage']
    },
    '/cart.html': {
      title: 'Cart | TUCKS Nigeria Campus Shopping',
      description: 'Review your TUCKS cart and checkout quickly for campus essentials, food, fashion and trusted student deals.',
      keywords: ['campus shopping', 'student marketplace', 'checkout'],
      type: 'WebPage',
      section: 'Cart',
      schema: ['WebPage']
    },
    '/about.html': {
      title: 'About TUCKS | Nigeria Campus Marketplace',
      description: 'Learn how TUCKS helps Nigerian students order food, shop from trusted campus vendors and buy and sell within university communities.',
      keywords: ['about TUCKS', 'campus marketplace', 'student shopping'],
      type: 'WebPage',
      section: 'About',
      schema: ['WebPage']
    },
    '/contact.html': {
      title: 'Contact TUCKS | Nigeria Campus Marketplace Support',
      description: 'Get in touch with TUCKS for support, vendor questions, campus delivery help and student marketplace enquiries.',
      keywords: ['contact TUCKS', 'student marketplace support', 'campus delivery support'],
      type: 'WebPage',
      section: 'Contact',
      schema: ['WebPage']
    },
    '/help.html': {
      title: 'Help Center | TUCKS Nigeria',
      description: 'Find help, FAQs, support and guidance for campus shopping, ordering food, and using TUCKS securely.',
      keywords: ['help center', 'student marketplace support', 'campus shopping help'],
      type: 'WebPage',
      section: 'Help Center',
      schema: ['WebPage', 'FAQPage']
    },
    '/terms.html': {
      title: 'Terms of Service & Privacy Policy | TUCKS Nigeria',
      description: 'Read TUCKS terms of service and privacy policy for student marketplace users, vendors and campus shoppers.',
      keywords: ['privacy policy', 'terms of service', 'student marketplace policy'],
      type: 'WebPage',
      section: 'Legal',
      schema: ['WebPage']
    },
    '/student-feed.html': {
      title: 'Student Feed | TUCKS Nigeria',
      description: 'Discover campus deals, student activity and community updates through TUCKS student feed in Nigeria.',
      keywords: ['student feed', 'campus community', 'student deals'],
      type: 'WebPage',
      section: 'Student Feed',
      schema: ['WebPage']
    }
  };

  const config = pageConfigs[normalizedPath] || pageConfigs[normalizedPath.replace(/\.html$/i, '.html')] || pageConfigs['/'];

  function ensureMetaTag(attributeName, attributeValue, content) {
    let tag = document.head.querySelector(`meta[${attributeName}="${attributeValue}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute(attributeName, attributeValue);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
    return tag;
  }

  function ensureLink(rel, href) {
    let link = document.head.querySelector(`link[rel="${rel}"]`);
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', rel);
      document.head.appendChild(link);
    }
    link.setAttribute('href', href);
    return link;
  }

  function addSchema(data) {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(data);
    document.head.appendChild(script);
  }

  function enhanceImages() {
    document.querySelectorAll('img').forEach((img) => {
      if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
      if (!img.hasAttribute('decoding')) img.setAttribute('decoding', 'async');
      if (!img.getAttribute('alt')) {
        img.setAttribute('alt', `${config.section || 'TUCKS'} image`);
      }
    });
  }

  function buildOrganizationSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'TUCKS',
      url: siteUrl,
      sameAs: [
        'https://www.facebook.com/',
        'https://www.instagram.com/'
      ],
      description: 'TUCKS is Nigeria\'s student-first campus marketplace for food delivery, trusted campus vendors, student deals, and campus essentials.',
      areaServed: 'Nigeria',
      slogan: 'Built for students, powered by students.'
    };
  }

  function buildWebsiteSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'TUCKS',
      url: siteUrl,
      description: config.description,
      potentialAction: {
        '@type': 'SearchAction',
        target: `${siteUrl}/home.html?q={search_term_string}`,
        'query-input': 'required name=search_term_string'
      }
    };
  }

  function buildBreadcrumbSchema() {
    const pathSegments = normalizedPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Home', item: siteUrl }];
    let current = siteUrl;
    pathSegments.forEach((segment) => {
      current = `${current}/${segment}`;
      breadcrumbs.push({ name: segment.replace(/[-_.]/g, ' '), item: current });
    });
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: breadcrumbs.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: item.item
      }))
    };
  }

  function buildFAQSchema() {
    const faqs = [
      {
        question: 'How does TUCKS help students on campus?',
        answer: 'TUCKS connects students with trusted vendors, food delivery, discounts and safe buying and selling within university communities.'
      },
      {
        question: 'Can I buy and sell within my university using TUCKS?',
        answer: 'Yes. TUCKS supports student-to-student buying and selling alongside campus vendor shopping and food ordering.'
      }
    ];
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((faq) => ({
        '@type': 'Question',
        name: faq.question,
        acceptedAnswer: { '@type': 'Answer', text: faq.answer }
      }))
    };
  }

  function buildWebApplicationSchema() {
    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'TUCKS',
      url: siteUrl,
      applicationCategory: 'ShoppingApplication',
      operatingSystem: 'All',
      description: 'A mobile-friendly campus marketplace for food, shopping, deals and student services.'
    };
  }

  function applySeo() {
    document.title = config.title;
    ensureMetaTag('name', 'description', config.description);
    ensureMetaTag('name', 'keywords', config.keywords.join(', '));
    ensureMetaTag('name', 'robots', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    ensureLink('canonical', `${siteUrl}${normalizedPath === '/' ? '' : normalizedPath}`);
    ensureMetaTag('property', 'og:title', config.title);
    ensureMetaTag('property', 'og:description', config.description);
    ensureMetaTag('property', 'og:type', config.type || 'website');
    ensureMetaTag('property', 'og:url', `${siteUrl}${normalizedPath === '/' ? '' : normalizedPath}`);
    ensureMetaTag('property', 'og:site_name', 'TUCKS');
    ensureMetaTag('property', 'og:image', `${siteUrl}/logo.png`);
    ensureMetaTag('name', 'twitter:card', 'summary_large_image');
    ensureMetaTag('name', 'twitter:title', config.title);
    ensureMetaTag('name', 'twitter:description', config.description);
    ensureMetaTag('name', 'twitter:image', `${siteUrl}/logo.png`);
    ensureMetaTag('name', 'twitter:site', '@tucksmarket');
    ensureMetaTag('name', 'theme-color', '#2563eb');

    const existingHeading = document.querySelector('main h1, .page h1, header h1, h1');
    if (existingHeading && !existingHeading.textContent.trim()) {
      existingHeading.textContent = config.title;
    }

    enhanceImages();

    addSchema(buildOrganizationSchema());
    addSchema(buildWebsiteSchema());
    addSchema(buildBreadcrumbSchema());
    addSchema(buildWebApplicationSchema());
    if (config.schema.includes('FAQPage')) addSchema(buildFAQSchema());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applySeo);
  } else {
    applySeo();
  }
})();
