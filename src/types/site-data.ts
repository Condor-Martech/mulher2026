import type { EventStatus, EventStatusConfig } from './event';

export interface NavLink {
  label: string;
  href: string;
  target?: string;
}

export interface SocialLink {
  name: string;
  url: string;
  bg: string;
  shadow: string;
  icon: string;
}

export interface SiteData {
  navbar: {
    links: NavLink[];
  };
  hero: {
    scrollLabel: string;
  };
  intro: {
    text: string;
    branding: {
      first: string;
      separator: string;
      second: string;
    };
    cta: string;
    location: string;
  };
  eventGrid: {
    api_url: string;
    titles: {
      first: string;
      second: string;
    };
    emptyMessage: string;
  };
  experience: {
    text: string;
    cta: string;
  };
  bannerCasa: {
    alt: string;
    ctaLabel: string;
    ctaLink: string;
  };
  partners: {
    sponsorsTitle: string;
    supportTitle: string;
    sponsors: string[];
    support: string[];
  };
  footer: {
    currentYear: number;
    copyright: string;
    socialLinks: SocialLink[];
  };
  statusConfig: Record<EventStatus, EventStatusConfig>;
}
