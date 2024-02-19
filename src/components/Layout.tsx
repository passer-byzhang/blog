import Footer from "./Footer";
import React, { useEffect, useState } from "react";
import Avator from "./Avator";
const Layout = ({ children }: { children: React.ReactNode }) => {
  const [avatarVisible, setAvatarVisible] = useState<boolean>(false);

  useEffect(() => {
    const handleScroll = () => {
      const avatar = document.getElementById("avatar");
      if (avatar) {
        const { top } = avatar.getBoundingClientRect();
        setAvatarVisible(top <= window.innerHeight);
      }
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className={`flex flex-col min-h-screen`}>
      <Avator />
      <div className="pb-[100px]">{children}</div>
      <Footer />
    </div>
  );
};

export default Layout;
