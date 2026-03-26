import React from 'react';
import { Link } from 'react-router-dom';
import { CONTACT_PHONE_DISPLAY } from '../config';

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    platform: [
      { name: 'Home', href: '/' }
    ],
    support: [
      { name: 'Contact Us', href: '/contact' },
      { name: 'About Us', href: '/about' },
    ]
  };

  const socialLinks = [
    {
      name: 'Instagram',
      href: 'https://www.instagram.com/heystudent.ig?igsh=MWNsdDU0bmltOWR0Zg%3D%3D&utm_source=qr',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
        </svg>
      )
    },
  ];

  return (
    <footer className="bg-neutral-900 text-white">
      <div className="w-full overflow-hidden">
        {/* Wave decoration */}
        <svg className="w-full h-12 text-[#fff9ed]" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M321.39,56.44c58-10.79,114.16-30.13,172-41.86,82.39-16.72,168.19-17.73,250.45-.39C823.78,31,906.67,72,985.66,92.83c70.05,18.48,146.53,26.09,214.34,3V0H0V27.35A600.21,600.21,0,0,0,321.39,56.44Z" fill="currentColor"></path>
        </svg>
      </div>
      
      <div className="container-custom section-padding">
        {/* Logo Section */}
        <div className="flex justify-center mb-12">
          <div className="text-white text-2xl font-bold">Heystudent</div>
        </div>

        {/* Main footer content */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8">
          {/* Brand section */}
          <div className="lg:col-span-2 space-y-6 text-center md:text-left">
            
            <p className="text-neutral-300 text-lg leading-relaxed max-w-md">
              CUET preparation taught by national rankers — real strategies, real PYQ breakdowns, and a community of serious aspirants.
            </p>
            
            {/* Social links */}
            <div className="flex justify-center md:justify-start space-x-4">
              {socialLinks.map((social) => (
                <a
                  key={social.name}
                  href={social.href}
                  className="w-10 h-10 bg-neutral-800 hover:bg-gradient-to-br hover:from-primary-500 hover:to-secondary-500 rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 group"
                  aria-label={social.name}
                >
                  <span className="text-neutral-400 group-hover:text-white transition-colors duration-300">
                    {social.icon}
                  </span>
                </a>
              ))}
            </div>
            

          </div>
          
          {/* Platform links */}
          <div>
            <h3 className="font-semibold text-white mb-6 text-lg text-center md:text-left">Platform</h3>
            <ul className="space-y-4">
              {footerLinks.platform.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-neutral-300 hover:text-white transition-colors duration-200 flex items-center group"
                  >
                    <svg className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Support links */}
          <div>
            <h3 className="font-semibold text-white mb-6 text-lg text-center md:text-left">Support</h3>
            <ul className="space-y-4">
              {footerLinks.support.map((link) => (
                <li key={link.name}>
                  <Link
                    to={link.href}
                    className="text-neutral-300 hover:text-white transition-colors duration-200 flex items-center group"
                  >
                    <svg className="w-4 h-4 mr-2 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Empty space for layout balance */}
          <div></div>
        </div>
        
        {/* Contact info */}
        <div className="mt-16 pt-8 border-t border-neutral-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            <div className="flex items-center md:items-start flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
              <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center mx-auto md:mx-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-center md:text-left">
                <h4 className="font-semibold text-white mb-1">Email</h4>
                <p className="text-neutral-300">heystudentyt@gmail.com</p>
              </div>
            </div>
            
            <div className="flex items-center md:items-start flex-col md:flex-row space-y-3 md:space-y-0 md:space-x-3">
              <div className="w-10 h-10 bg-neutral-800 rounded-xl flex items-center justify-center mx-auto md:mx-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div className="text-center md:text-left">
                <h4 className="font-semibold text-white mb-1">Phone</h4>
                <p className="text-neutral-300">{CONTACT_PHONE_DISPLAY}<br /></p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom footer */}
        <div className="mt-12 pt-8 border-t border-neutral-800">
          <div className="flex flex-col md:flex-row justify-center md:justify-between items-center space-y-4 md:space-y-0">
            <p className="text-neutral-400 text-sm text-center md:text-left">
              &copy; {currentYear} Heystudent. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 text-sm text-neutral-400">
              <span>Made with</span>
              <div className="flex items-center space-x-1">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                <span>for CUET aspirants</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;