import React from "react";
import "./App.css";
import { HashRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./Navbar/Navbar";
import Home from "./views/Home";
import About from "./views/About";
import Recents from "./views/Recents";
import Contact from "./views/Contact";

const App: React.FC = () => {
  return (
    <div className="app-container">
      <Router>
        <Navbar />
        <div className="views">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/mywork" element={<Recents />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </div>
      </Router>
    </div>
  );
};

export default App;
