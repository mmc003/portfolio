import React from "react";
import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Home from "./views/Home";
import About from "./views/About";
import MyWork from "./views/MyWork";
import Contact from "./views/Contact";

const App: React.FC = () => {
  return (
    <div className="app-container">
      <Router>
        <Navbar />
        <div className="views">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/mywork" element={<MyWork />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </div>
      </Router>
    </div>
  );
};

export default App;
