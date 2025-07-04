"use client"

import React, { ReactNode, useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, Anchor, Globe, Users, Briefcase, Map, X } from "lucide-react"

const LoadingPlaceholder = () => (
  <div className="animate-pulse h-20 bg-gray-200 rounded"></div>
)

interface UnderConstructionPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

// Popup komponent informujący o budowie strony
const UnderConstructionPopup = ({ isOpen, onClose }: UnderConstructionPopupProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-[100]">
      <div className="absolute inset-0 bg-black/70" onClick={onClose}></div>
      <div className="relative bg-white rounded-xl p-8 max-w-md mx-4 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-[#0e1e40]"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="text-center">
          <div className="w-16 h-16 bg-[#0e1e40] rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-2xl text-white">🚧</span>
          </div>
          <h3 className="text-2xl font-bold text-[#0e1e40] mb-3">Under construction</h3>
          <div className="w-16 h-1 bg-[#d6af6b] mx-auto rounded-full mb-4"></div>
          <p className="text-gray-600 mb-6">
            Thank you for your interest! This section is currently under construction.
            We are working hard to provide you with an exceptional experience. Please check back soon.
          </p>
          <button
            onClick={onClose}
            className="bg-[#0e1e40] text-white px-6 py-3 rounded-md font-medium hover:bg-[#0e1e40]/90 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

const ClientOnly = ({ children, fallback = <LoadingPlaceholder /> }: ClientOnlyProps) => {
  const [hasMounted, setHasMounted] = useState(false)
  useEffect(() => setHasMounted(true), [])
  return hasMounted ? <>{children}</> : fallback
}

interface CTALink {
  text: string;
  link: string;
}

interface BoatCardProps {
  model: string;
  type: string;
  features: string[];
  image: string;
  cta: CTALink;
  openPopup: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

const BoatCard = ({ model, type, features, image, cta, openPopup }: BoatCardProps) => (
  <div className="group relative overflow-hidden rounded-xl bg-white shadow-lg transition-all duration-300 hover:shadow-xl">
    <div className="relative h-17 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-[#0e1e40]/80 to-transparent z-10 transition-opacity duration-300 group-hover:opacity-0"></div>
      <img
        src={image}
        alt={`${model} boat`}
        className="h-full w-full object-cover transition-all duration-700 group-hover:scale-105"
      />
      <div className="absolute bottom-4 left-4 z-20">
        <h3 className="text-2xl font-bold text-white">{model}</h3>
        <p className="text-sm text-[#d6af6b]">{type}</p>
      </div>
    </div>
    <div className="p-6">
      <ul className="mb-4 space-y-2">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start">
            <ChevronRight className="mr-2 h-5 w-5 flex-shrink-0 text-[#d6af6b]" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      <div className="pt-2">
        <a href="#" onClick={openPopup} className="inline-flex items-center rounded bg-[#0e1e40] px-4 py-2 text-sm font-medium text-white transition-all duration-300 hover:bg-[#0e1e40]/90">
          {cta.text}
          <ChevronRight className="ml-1 h-4 w-4" />
        </a>
      </div>
    </div>
  </div>
)

interface ExpeditionCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  image: string;
  cta: CTALink;
  openPopup: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}

const ExpeditionCard = ({ title, description, icon: Icon, image, cta, openPopup }: ExpeditionCardProps) => (
  <div className="group relative overflow-hidden rounded-xl bg-white shadow-lg transition-all duration-300 hover:shadow-xl">
    <div className="relative h-84 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-t from-[#0e1e40]/80 to-transparent z-10 transition-opacity duration-300 group-hover:opacity-0"></div>
      <img
        src={image}
        alt={title}
        className="h-full w-full object-cover transition-all duration-700 group-hover:scale-105"
      />
    </div>
    <div className="p-6">
      <div className="mb-4 flex items-center">
        <div className="mr-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#d6af6b]">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <h3 className="text-xl font-bold text-[#0e1e40]">{title}</h3>
      </div>
      <p className="mb-4 text-gray-600">{description}</p>
      <div className="pt-2">
        <a href="#" onClick={openPopup} className="inline-flex items-center text-[#d6af6b] transition-all duration-300 hover:text-[#0e1e40]">
          {cta.text}
          <ChevronRight className="ml-1 h-4 w-4" />
        </a>
      </div>
    </div>
  </div>
)

const SalpaExpeditionsWebsite = () => {
  const [scrolled, setScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isPopupOpen, setIsPopupOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const openPopup = (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault()
    setIsPopupOpen(true)
  }

  const closePopup = () => {
    setIsPopupOpen(false)
  }

  // Funkcja do płynnego przewijania do sekcji
  const scrollToSection = (e: React.MouseEvent<HTMLAnchorElement>, sectionId: string) => {
    e.preventDefault();
    const section = document.getElementById(sectionId);
    if (section) {
      // Dodaj offset dla górnej nawigacji
      const offsetTop = section.offsetTop - 10;
      window.scrollTo({
        top: offsetTop,
        behavior: 'smooth'
      });
    }
  };

  // Boat collections based on images provided
  const inflatableBoats = [
    {
      model: "Soleil 33",
      type: "Premium Inflatable",
      image: "/images/soleil-33.jpg",
      features: [
        "New hull, deck, and design for excellent navigability",
        "Large sundeck with decentralized console",
        "Kitchen cabinet with refrigerator",

      ],
      cta: { text: "Explore Soleil 33", link: "/boats/soleil-33" }
    },
    {
      model: "Soleil 52",
      type: "Inflatable Boat",
      image: "/images/soleil-52.jpg",
      features: [
        "Exceptional stability in rough waters",
        "Superior performance with lower fuel consumption",
        "Spacious deck with multiple seating options",

      ],
      cta: { text: "Explore Soleil 52", link: "/boats/soleil-52" }
    }
  ]

  const premiumBoats = [
    {
      model: "Avantgarde 35",
      type: "Luxury Cruiser",
      image: "/images/avantgarde-35.jpg",
      features: [
        "Elegant design with premium finishes",
        "Spacious cabin with sleeping quarters",
        "Advanced navigation and entertainment systems",
      ],
      cta: { text: "Explore Avantgarde 35", link: "/boats/avantgarde-35" }
    },
    {
      model: "Laver 23XL",
      type: "Sport Cruiser",
      image: "/images/laver-23xl.jpg",
      features: [
        "Perfect balance of performance and comfort",
        "Innovative deck layout maximizing space",
        "Premium materials and finishes throughout",
      ],
      cta: { text: "Explore Laver 23XL", link: "/boats/laver-23xl" }
    }
  ]

  // Expedition types
  const expeditions = [
    {
      title: "Family Expeditions",
      icon: Users,
      image: "/images/family-expedition.png",
      description: "Create unforgettable memories with your loved ones on our specially designed family-friendly boat trips. Safe, fun, and educational experiences for all ages.",
      cta: { text: "Plan your family adventure", link: "/expeditions/family" }
    },
    {
      title: "Business Networking Trips",
      icon: Briefcase,
      image: "/images/business-expedition.jpg",
      description: "Impress your clients or build team connections in an exclusive setting. Our business expeditions provide the perfect backdrop for meaningful professional interactions.",
      cta: { text: "Elevate your business events", link: "/expeditions/business" }
    },
    {
      title: "Caravaning and Water Events",
      icon: Map,
      image: "/images/coastal-expedition.jpg",
      description: "Discover hidden coves, pristine beaches, and breathtaking coastal landscapes. Our expert guides will take you to the most beautiful spots along the coastline.",
      cta: { text: "Start your coastal journey", link: "/expeditions/coastal" }
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800">
      {/* Popup komponent */}
      <UnderConstructionPopup isOpen={isPopupOpen} onClose={closePopup} />

      {/* Header */}
      <header className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#0e1e40] py-3 shadow-md' : 'bg-gradient-to-b from-[#0e1e40] to-transparent py-5'}`}>
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between">
            <a href="#" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                e.preventDefault();
                window.scrollTo({
                  top: 0,
                  behavior: 'smooth'
                });
              }} className="relative z-10">
              <img
                src="/salpa-logo.png"
                alt="Salpa Expeditions Logo"
                className="h-12 md:h-14 object-contain"
              />
            </a>

            {/* Desktop Navigation */}
            <nav className="hidden md:block">
              <ul className="flex space-x-8">
                <li><a href="#expeditions" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'expeditions')} className="text-white hover:text-[#d6af6b] transition-colors text-sm uppercase tracking-wider font-medium">Expeditions</a></li>
                <li><a href="#laminated-boats" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'laminated-boats')} className="text-white hover:text-[#d6af6b] transition-colors text-sm uppercase tracking-wider font-medium">Luxury Boats</a></li>
                <li><a href="#inflatable-boats" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'inflatable-boats')} className="text-white hover:text-[#d6af6b] transition-colors text-sm uppercase tracking-wider font-medium">Inflatable Boats</a></li>
                <li><a href="#about" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'about')} className="text-white hover:text-[#d6af6b] transition-colors text-sm uppercase tracking-wider font-medium">About Us</a></li>
                <li><a href="#contact" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'contact')} className="text-white hover:text-[#d6af6b] transition-colors text-sm uppercase tracking-wider font-medium">Contact</a></li>
              </ul>
            </nav>

            {/* Mobile menu button */}
            <button
              className="md:hidden relative z-10 p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <div className={`w-6 h-0.5 bg-white mb-1.5 transition-all ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></div>
              <div className={`w-6 h-0.5 bg-white mb-1.5 transition-all ${mobileMenuOpen ? 'opacity-0' : ''}`}></div>
              <div className={`w-6 h-0.5 bg-white transition-all ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></div>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className={`fixed inset-0 bg-[#0e1e40] z-0 transition-all duration-300 ${mobileMenuOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}>
          <div className="pt-24 px-6">
            <ul className="space-y-6">
              <li><a href="#expeditions" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => { scrollToSection(e, 'expeditions'); setMobileMenuOpen(false); }} className="text-white hover:text-[#d6af6b] transition-colors text-xl font-medium block">Expeditions</a></li>
              <li><a href="#laminated-boats" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => { scrollToSection(e, 'laminated-boats'); setMobileMenuOpen(false); }} className="text-white hover:text-[#d6af6b] transition-colors text-xl font-medium block">Luxury Boats</a></li>
              <li><a href="#inflatable-boats" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => { scrollToSection(e, 'inflatable-boats'); setMobileMenuOpen(false); }} className="text-white hover:text-[#d6af6b] transition-colors text-xl font-medium block">Inflatable Boats</a></li>
              <li><a href="#about" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => { scrollToSection(e, 'about'); setMobileMenuOpen(false); }} className="text-white hover:text-[#d6af6b] transition-colors text-xl font-medium block">About Us</a></li>
              <li><a href="#contact" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => { scrollToSection(e, 'contact'); setMobileMenuOpen(false); }} className="text-white hover:text-[#d6af6b] transition-colors text-xl font-medium block">Contact</a></li>
            </ul>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative h-screen">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-[#0e1e40]/80 via-[#0e1e40]/50 to-transparent z-10"></div>
          <img
            src="/images/hero-boat.jpg"
            alt="Luxury boat on water"
            className="w-full h-full object-cover object-center"
          />
        </div>
        <div className="relative z-20 flex h-full items-center">
          <div className="container mx-auto px-4 pt-24">
            <div className="max-w-2xl">
              <h1 className="mb-4 text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight">
                Experience the <span className="text-[#d6af6b]">Ultimate</span> Sea Adventure
              </h1>
              <p className="mb-8 text-lg text-white/90 max-w-md">
                Discover premium boating adventures and luxury vessels crafted by the finest Italian boat builders.
              </p>
              <div className="flex flex-wrap gap-4">
                <a href="#expeditions" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'expeditions')} className="inline-flex items-center bg-[#d6af6b] px-6 py-3 text-white font-medium rounded-md transition-all hover:bg-[#d6af6b]/90">
                  Explore Expeditions
                  <ChevronRight className="ml-2 h-5 w-5" />
                </a>
                <a href="#inflatable-boats" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'inflatable-boats')} className="inline-flex items-center bg-white/10 backdrop-blur-sm px-6 py-3 text-white font-medium rounded-md border border-white/30 transition-all hover:bg-white/20">
                  View Our Boats
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main>
        {/* Expeditions Section */}
        <section id="expeditions" className="py-24 px-4">
          <div className="container mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#0e1e40]">Unforgettable Expeditions</h2>
              <div className="w-24 h-1 bg-[#d6af6b] mx-auto rounded-full mb-6"></div>
              <p className="max-w-full mx-auto text-lg text-gray-600 md:whitespace-nowrap text-center">
                Choose from our curated selection of premium maritime experiences tailored for every adventure seeker
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {expeditions.map((expedition, index) => (
                <ExpeditionCard key={index} {...expedition} openPopup={openPopup} />
              ))}
            </div>
          </div>
        </section>

        {/* Brand Story Section */}
        <section className="bg-[#0e1e40] py-24 px-4">
          <div className="container mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">Italian Excellence <br/>in Boat Building</h2>
                <div className="w-24 h-1 bg-[#d6af6b] rounded-full mb-8"></div>
                <p className="text-white/80 mb-6 text-lg">
                  Since 1987, Salpa has embodied the finest traditions of Italian boat craftsmanship, combining elegant design with exceptional performance.
                </p>
                <p className="text-white/80 mb-8 text-lg">
                  Our vessels are created for those who appreciate luxury, comfort, and superior navigability. Each boat is a testament to our commitment to excellence, innovation, and the artisanal traditions that make Italian boats world-renowned.
                </p>
                <div className="flex items-center">
                  <div className="w-64 mr-6">
                    <img src="/images/italian-flag.png" alt="Italian craftsmanship" className="w-full" />
                  </div>
                </div>
              </div>
              <div className="relative h-96 md:h-160 rounded-xl overflow-hidden">
                <img
                  src="/images/boat-crafting.jpg"
                  alt="Italian boat craftsmanship"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Inflatable Boats Section */}
        <section id="inflatable-boats" className="py-24 px-4 bg-gray-50">
          <div className="container mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#0e1e40]">Inflatable Boats</h2>
              <div className="w-24 h-1 bg-[#d6af6b] mx-auto rounded-full mb-6"></div>
              <p className="max-w-full mx-auto text-lg text-gray-600 md:whitespace-nowrap">
                A complete range of elegant, original and unifying boats delivering optimal performance without compromising on comfort
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {inflatableBoats.map((boat, index) => (
                <BoatCard key={index} {...boat} openPopup={openPopup} />
              ))}
            </div>

            <div className="mt-12 text-center">
              <a href="#" onClick={openPopup} className="inline-flex items-center bg-[#0e1e40] px-6 py-3 text-white font-medium rounded-md transition-all hover:bg-[#0e1e40]/90">
                View All Inflatable Boats
                <ChevronRight className="ml-2 h-5 w-5" />
              </a>
            </div>
          </div>
        </section>

        {/* Laminated Boats Section */}
        <section id="laminated-boats" className="py-24 px-4">
          <div className="container mx-auto">
            <div className="mb-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-[#0e1e40]">Luxury Boats</h2>
              <div className="w-24 h-1 bg-[#d6af6b] mx-auto rounded-full mb-6"></div>
              <p className="max-w-2xl mx-auto text-lg text-gray-600">
                Beauty, comfort and performance to satisfy your desire to experience the sea
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {premiumBoats.map((boat, index) => (
                <BoatCard key={index} {...boat} openPopup={openPopup} />
              ))}
            </div>

            <div className="mt-12 text-center">
              <a href="#" onClick={openPopup} className="inline-flex items-center bg-[#0e1e40] px-6 py-3 text-white font-medium rounded-md transition-all hover:bg-[#0e1e40]/90">
                Explore All Luxury Boats
                <ChevronRight className="ml-2 h-5 w-5" />
              </a>
            </div>
          </div>
        </section>

        {/* About Us Section */}
            <section id="about" className="pt-48 pb-24 px-4 bg-gray-50">
              <div className="container mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 items-center">
                  <div className="md:col-span-5 flex flex-col">
                    <h2 className="text-3xl md:text-4xl font-bold mb-6 text-[#0e1e40]">About Salpa Expeditions</h2>
                    <div className="w-24 h-1 bg-[#d6af6b] rounded-full mb-8"></div>
                    <p className="mb-6 text-lg text-gray-600">
                      Salpa Expeditions combines the heritage of Italian boat craftsmanship with exceptional maritime adventures across the most beautiful waters of Europe.
                    </p>
                    <p className="mb-8 text-lg text-gray-600">
                      As the premium expedition division of Salpa boats, we provide unique experiences that showcase the performance, comfort, and elegance of our vessels through carefully curated journeys.
                    </p>
                    <div className="flex space-x-6">
                      <div className="flex items-center">
                        <div className="mr-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#d6af6b]/20">
                          <Anchor className="h-6 w-6 text-[#d6af6b]" />
                        </div>
                        <div>
                          <h4 className="font-bold text-[#0e1e40]">35+ Years</h4>
                          <p className="text-sm text-gray-600">Boat Building</p>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <div className="mr-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#d6af6b]/20">
                          <Globe className="h-6 w-6 text-[#d6af6b]" />
                        </div>
                        <div>
                          <h4 className="font-bold text-[#0e1e40]">12+ Countries</h4>
                          <p className="text-sm text-gray-600">Global Presence</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="md:col-span-7">
                    <div className="h-full rounded-xl overflow-hidden">
                      <img
                        src="/images/about-1.jpg"
                        alt="Salpa boat journey"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>
      </main>

      {/* Contact Section */}
      <section id="contact" className="bg-[#0e1e40] text-white py-24 px-4">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready for Your Adventure?</h2>
              <div className="w-24 h-1 bg-[#d6af6b] rounded-full mb-8"></div>
              <p className="mb-8 text-lg text-white/80">
                Contact our team to book your expedition or inquire about purchasing one of our premium boats.
              </p>
              <div className="space-y-6">
                <div className="flex items-center">
                  <div className="mr-4 h-12 w-12 flex items-center justify-center rounded-full bg-[#d6af6b]/20">
                    <span className="text-xl">📞</span>
                  </div>
                  <div>
                    <p className="text-sm text-white/60">Call Us</p>
                    <a href="tel:+48534874104" className="text-lg font-medium hover:text-[#d6af6b] transition-colors">
                      +48 534 874 104
                    </a>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="mr-4 h-12 w-12 flex items-center justify-center rounded-full bg-[#d6af6b]/20">
                    <span className="text-xl">✉️</span>
                  </div>
                  <div>
                    <p className="text-sm text-white/60">Email Us</p>
                    <a href="#" onClick={openPopup} className="text-lg font-medium hover:text-[#d6af6b] transition-colors">
                      info@salpaexpeditions.com
                    </a>
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="mr-4 h-12 w-12 flex items-center justify-center rounded-full bg-[#d6af6b]/20">
                    <span className="text-xl">📍</span>
                  </div>
                  <div>
                    <p className="text-sm text-white/60">Visit Us</p>
                    <p className="text-lg font-medium">
                      Via Marina, 16, 80059 Torre del Greco NA, Italy
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div>
              <form className="bg-white p-8 rounded-xl shadow-lg">
                <h3 className="text-xl font-bold text-[#0e1e40] mb-6">Send us a message</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#d6af6b]" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#d6af6b]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <input type="email" className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#d6af6b]" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">I'm interested in</label>
                    <select className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#d6af6b]">
                      <option>Booking an expedition</option>
                      <option>Purchasing a boat</option>
                      <option>Learning about custom options</option>
                      <option>Other inquiry</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea rows={4} className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#d6af6b]"></textarea>
                  </div>
                  <button
                    type="button"
                    onClick={openPopup}
                    className="w-full bg-[#0e1e40] text-white font-medium px-6 py-3 rounded-md hover:bg-[#0e1e40]/90 transition-colors"
                  >
                    Submit Message
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0e1e40] text-white py-12 px-4 border-t border-white/10">
        <div className="container mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-4">
              <img
                src="/salpa-logo.png"
                alt="Salpa Expeditions Logo"
                className="h-16 object-contain mb-6"
              />
              <p className="text-white/70 mb-6">
                Combining Italian craftsmanship with exceptional maritime adventures to create unforgettable experiences on the water.
              </p>
              <div className="flex space-x-4">
                <a href="#" onClick={openPopup} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#d6af6b] transition-colors">
                  <span className="text-sm">FB</span>
                </a>
                <a href="#" onClick={openPopup} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#d6af6b] transition-colors">
                  <span className="text-sm">IG</span>
                </a>
                <a href="#" onClick={openPopup} className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-[#d6af6b] transition-colors">
                  <span className="text-sm">YT</span>
                </a>
              </div>
            </div>
            <div className="md:col-span-2">
              <h4 className="text-lg font-bold mb-4">Quick Links</h4>
              <ul className="space-y-3">
                <li><a href="#" onClick={openPopup} className="text-white/70 hover:text-[#d6af6b] transition-colors">Home</a></li>
                <li><a href="#expeditions" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'expeditions')} className="text-white/70 hover:text-[#d6af6b] transition-colors">Expeditions</a></li>
                <li><a href="#inflatable-boats" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'inflatable-boats')} className="text-white/70 hover:text-[#d6af6b] transition-colors">Boats</a></li>
                <li><a href="#about" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'about')} className="text-white/70 hover:text-[#d6af6b] transition-colors">About Us</a></li>
                <li><a href="#contact" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'contact')} className="text-white/70 hover:text-[#d6af6b] transition-colors">Contact</a></li>
              </ul>
            </div>
            <div className="md:col-span-3">
              <h4 className="text-lg font-bold mb-4">Boat Categories</h4>
              <ul className="space-y-3">
                <li><a href="#inflatable-boats" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'inflatable-boats')} className="text-white/70 hover:text-[#d6af6b] transition-colors">Inflatable Boats</a></li>
                <li><a href="#laminated-boats" onClick={(e: React.MouseEvent<HTMLAnchorElement>) => scrollToSection(e, 'laminated-boats')} className="text-white/70 hover:text-[#d6af6b] transition-colors">Luxury Boats</a></li>
                <li><a href="#" onClick={openPopup} className="text-white/70 hover:text-[#d6af6b] transition-colors">Customization Options</a></li>
                <li><a href="#" onClick={openPopup} className="text-white/70 hover:text-[#d6af6b] transition-colors">Boat Maintenance</a></li>
                <li><a href="#" onClick={openPopup} className="text-white/70 hover:text-[#d6af6b] transition-colors">Warranty Information</a></li>
              </ul>
            </div>
            <div className="md:col-span-3">
              <h4 className="text-lg font-bold mb-4">Contact Information</h4>
              <ul className="space-y-3">
                <li className="flex items-center">
                  <span className="mr-2 text-[#d6af6b]">📞</span>
                  <a href="tel:+48534874104" className="text-white/70 hover:text-[#d6af6b] transition-colors">+48 534 874 104</a>
                </li>
                <li className="flex items-center">
                  <span className="mr-2 text-[#d6af6b]">✉️</span>
                  <a href="#" onClick={openPopup} className="text-white/70 hover:text-[#d6af6b] transition-colors">info@salpaexpeditions.com</a>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 text-[#d6af6b]">📍</span>
                  <span className="text-white/70">Via Marina, 16, 80059 Torre del Greco NA, Italy</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-white/10 text-center text-white/60">
            <p>&copy; 2025 Salpa Expeditions. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default SalpaExpeditionsWebsite