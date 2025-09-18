'use client'
import React, { useState, useEffect } from 'react';
import { BarChart3, Database, Upload, MessageSquare, ChevronRight, Star, Users, TrendingUp } from 'lucide-react';
import Image from 'next/image';
import Logo from '@/app/images/Logo.png';
import Logo_name from '@/app/images/Logo_name.png';
import { useRouter } from 'next/navigation';
export default function LandingPage() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentFeature, setCurrentFeature] = useState(0);
  const router = useRouter();
  
  useEffect(() => {
    setIsVisible(true);
    const interval = setInterval(() => {
      setCurrentFeature((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Natural Language Queries",
      description: "Ask questions in plain English and get instant insights"
    },
    {
      icon: <Database className="w-8 h-8" />,
      title: "Multiple Data Sources",
      description: "Connect databases or upload CSV files seamlessly"
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Auto-Generated Charts",
      description: "Beautiful visualizations created automatically"
    }
  ];

  const stats = [
    { icon: <Users className="w-6 h-6" />, value: "10K+", label: "Active Users" },
    { icon: <TrendingUp className="w-6 h-6" />, value: "1M+", label: "Queries Processed" },
    { icon: <Star className="w-6 h-6" />, value: "4.9", label: "User Rating" }
  ];

  return (
    <div className="min-h-screen bg-[#30302e] text-white overflow-hidden">
      {/* Animated background elements */}
      {/* <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-4 -right-4 w-72 h-72 bg-[#ff4866] rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute top-1/2 -left-8 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute bottom-8 right-1/3 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-4000"></div>
      </div> */}

      {/* Navigation */}
      <nav className="relative z-10 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="  rounded-lg flex items-center justify-center">
              <Image src={Logo} alt="Logo" className="w-12 h-12 text-white" />
            </div>
            <span className="text-xl  bg-clip-text text-transparent">
              <Image src={Logo_name} alt="Logo Name" className="w-32 h-12" />
            </span>
          </div>
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-300 hover:text-white transition-colors duration-300">Features</a>
            <a href="#how-it-works" className="text-gray-300 hover:text-white transition-colors duration-300">How it Works</a>
            <button onClick={() => router.push('/sign-up')} className="px-6 py-2 bg-[#ff4866] rounded-full text-white font-medium hover:shadow-lg hover:shadow-white transition-all duration-300 transform hover:scale-105">
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative z-10 px-6 pt-20 pb-32">
        <div className="max-w-7xl mx-auto text-center">
          <div className={`transform transition-all duration-1000 ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}>
            <h1 className="text-6xl md:text-7xl font-bold mb-8 leading-tight">
              Ask Your Data
              <span className="block text-[#ff4866] bg-clip-text ">
                Anything
              </span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Transform complex data queries into simple conversations. Get instant insights, beautiful charts, and actionable intelligence from any dataset.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button onClick={() => router.push('/sign-up')} className="group px-8 py-4 bg-[#ff4866] rounded-full text-lg font-semibold hover:shadow-xl hover:shadow-whitetransition-all duration-300 transform hover:scale-105 flex items-center space-x-2">
                <span>Start Analyzing</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
              </button>
              
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-col md:flex-row justify-center items-center space-y-6 md:space-y-0 md:space-x-12 mb-20">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="text-[#ff4866] group-hover:text-[#ff4866] transition-colors duration-300">
                    {stat.icon}
                  </div>
                  <span className="text-3xl font-bold">{stat.value}</span>
                </div>
                <p className="text-gray-400">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div id="features" className="relative z-10 px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-4">
            Powerful Features
          </h2>
          <p className="text-xl text-gray-400 text-center mb-16 max-w-2xl mx-auto">
            Everything you need to turn data into actionable insights
          </p>
          
          <div className="grid md:grid-cols-3 gap-8 mb-20">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`group p-8 rounded-2xl border border-gray-700 hover:border-orange-500/50 transition-all duration-500 transform hover:scale-105 ${
                  currentFeature === index ? 'bg-[#ff9542] border-orange-500/50' : 'bg-[#262624]'
                }`}
              >
                <div className="text-[#ff4866] transition-colors duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-400 group-hover:text-gray-300 transition-colors duration-300">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="relative z-10 px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-5xl font-bold text-center mb-16">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: <Upload />, title: "Connect Data", desc: "Upload CSV files or connect your database" },
              { icon: <MessageSquare />, title: "Ask Questions", desc: "Type your questions in plain English" },
              { icon: <BarChart3 />, title: "Get Insights", desc: "Receive tables, charts, and explanations" }
            ].map((step, index) => (
              <div key={index} className="text-center group">
                <div className="relative mb-6">
                  <div className="w-20 h-20 mx-auto bg-[#ff9542] rounded-full flex items-center justify-center text-2xl font-bold group-hover:shadow-lg group-hover:shadow-purple-500/25 transition-all duration-300 transform group-hover:scale-110">
                    {step.icon}
                  </div>
                  <div className="absolute top-0 right-0 w-8 h-8 bg-[#ff4866] rounded-full flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-gray-400">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="relative z-10 px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-[#30302e] p-12 rounded-3xl border border-[#ff9542]">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to Transform Your Data?
            </h2>
            <p className="text-xl text-gray-300 mb-8">
              Join thousands of analysts who are already getting instant insights from their data.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button onClick={() => router.push('/sign-up')} className="px-10 py-4 bg-[#ff9542] rounded-full text-lg font-semibold hover:shadow-xl hover:shadow-white transition-all duration-300 transform hover:scale-105">
                Start Free Trial
              </button>
              
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 px-6 py-12 border-t border-[#ff9542]">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className=" rounded-lg flex items-center justify-center">
              <Image src={Logo} alt="Logo" className="w-10 h-10 text-white" />
            </div>
            <span className="text-lg font-bold  bg-clip-text text-transparent">
              <Image src={Logo_name} alt="Logo Name" className="w-24 h-10" />
            </span>
          </div>
          <p className="text-gray-400">
            © 2025 DataAnalyst AI. Making data analysis accessible to everyone.
          </p>
        </div>
      </footer>
    </div>
  );
}