import React from "react";
import { Link } from "react-router-dom";

const MainHome = () => {
  const openNav = () => {
    document.getElementById("overlay").style.width = "100%";
  };

  const closeNav = () => {
    document.getElementById("overlay").style.width = "0%";
  };

  return (
    <>
      <button onClick={openNav}>
        <i className="fas fa-bars"></i>
      </button>

      <div className="overlay" id="overlay">
        <div className="overlay-content">
          <i
            className="fas fa-x"
            style={{ cursor: "pointer" }}
            onClick={closeNav}
          ></i>
          <a href="#">
            <i className="fas fa-house"></i> Home
          </a>
          <a href="#">
            <i className="fas fa-info"></i> About Us
          </a>
          <a href="#">
            <i className="fas fa-users"></i> Exclusive Membership
          </a>
          <a href="#">
            <i className="fas fa-file-code"></i> Web Kits
          </a>
          <a href="#">
            <i className="fas fa-phone"></i> Contact Us
          </a>
        </div>
      </div>

      <section id="home">
        <div className="hero-title">
            {/* /VoiceHub  */}
          <span>V</span>
          <span>o</span>
          <span>i</span>
          <span>c</span>
          <span>e</span>
          <span>H</span>
          <span>u</span>
          <span>b</span>
        </div>
        <div className="hero-title-2">
          <span>S</span>
          <span>t</span>
          <span>u</span>
          <span>d</span>
          <span>i</span>
          <span>o</span>
        </div>
        <div className="btns">
          <Link className="btn fas fa-magnifying-glass" to={'/screen-record'}>
            Screen Recorder
          </Link>
          <Link className="btn fas fa-users" to={'/video'}>
            Join Call
          </Link>
          <Link className="btn fas fa-phone" to={'/contact'}>Contact Us</Link>
        </div>
      </section>
    </>
  );
};

export default MainHome;
