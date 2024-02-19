import React from "react";

const Footer = () => {
  return (
    <footer
      id="footer"
      className={`footer w-full bg-gray-900 text-white py-1 fixed bottom-0`}
    >
      <aside>
        <div className="container mx-auto text-center">
          <p className="text-xs">
            &copy; 2023 Alvan Blog. All rights reserved.
          </p>
        </div>
      </aside>
    </footer>
  );
};

export default Footer;
