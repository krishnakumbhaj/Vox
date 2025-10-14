import React from 'react';

const IcosphereLoader = ({ size = 120, color = '#4A90E2' }) => {
            return (
                        <div 
                                    className="flex items-center justify-center min-h-screen"
                                    style={{ width: '100vw', height: '100vh' }}
                        >
                                    <div 
                                                className="relative"
                                                style={{ 
                                                            width: size, 
                                                            height: size,
                                                }}
                                    >
                                                <svg 
                                                            width={size} 
                                                            height={size} 
                                                            viewBox="0 0 200 200" 
                                                            className="absolute inset-0"
                                                >
                                                            <defs>
                                                                        <style>
                                                                                    {`
                                                                                                @keyframes expand-contract {
                                                                                                            0%, 100% { transform: scale(0.8); opacity: 0.7; }
                                                                                                            50% { transform: scale(1.2); opacity: 1; }
                                                                                                }
                                                                                                
                                                                                                .triangle { 
                                                                                                            animation: expand-contract 2s ease-in-out infinite;
                                                                                                            transform-origin: center;
                                                                                                }
                                                                                                
                                                                                                .triangle:nth-child(1) { animation-delay: 0s; }
                                                                                                .triangle:nth-child(2) { animation-delay: 0.1s; }
                                                                                                .triangle:nth-child(3) { animation-delay: 0.2s; }
                                                                                                .triangle:nth-child(4) { animation-delay: 0.3s; }
                                                                                                .triangle:nth-child(5) { animation-delay: 0.4s; }
                                                                                                .triangle:nth-child(6) { animation-delay: 0.5s; }
                                                                                                .triangle:nth-child(7) { animation-delay: 0.6s; }
                                                                                                .triangle:nth-child(8) { animation-delay: 0.7s; }
                                                                                                .triangle:nth-child(9) { animation-delay: 0.8s; }
                                                                                                .triangle:nth-child(10) { animation-delay: 0.9s; }
                                                                                                .triangle:nth-child(11) { animation-delay: 1s; }
                                                                                                .triangle:nth-child(12) { animation-delay: 1.1s; }
                                                                                                .triangle:nth-child(13) { animation-delay: 1.2s; }
                                                                                                .triangle:nth-child(14) { animation-delay: 1.3s; }
                                                                                                .triangle:nth-child(15) { animation-delay: 1.4s; }
                                                                                                .triangle:nth-child(16) { animation-delay: 1.5s; }
                                                                                                .triangle:nth-child(17) { animation-delay: 1.6s; }
                                                                                                .triangle:nth-child(18) { animation-delay: 1.7s; }
                                                                                                .triangle:nth-child(19) { animation-delay: 1.8s; }
                                                                                                .triangle:nth-child(20) { animation-delay: 1.9s; }
                                                                                    `}
                                                                        </style>
                                                            </defs>
                                                            
                                                            <g transform="translate(100,100)">
                                                                        {/* Top cap triangles */}
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 0,-60 L 35,-30 L -35,-30 Z"
                                                                                    fill={color}
                                                                                    opacity="0.9"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        
                                                                        {/* Upper ring triangles */}
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 35,-30 L 60,0 L 20,-10 Z"
                                                                                    fill={color}
                                                                                    opacity="0.85"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 60,0 L 35,30 L 20,-10 Z"
                                                                                    fill={color}
                                                                                    opacity="0.8"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 35,30 L 0,60 L 20,-10 Z"
                                                                                    fill={color}
                                                                                    opacity="0.75"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 0,60 L -35,30 L 20,-10 Z"
                                                                                    fill={color}
                                                                                    opacity="0.7"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M -35,30 L -60,0 L 20,-10 Z"
                                                                                    fill={color}
                                                                                    opacity="0.65"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M -60,0 L -35,-30 L 20,-10 Z"
                                                                                    fill={color}
                                                                                    opacity="0.6"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M -35,-30 L 35,-30 L 20,-10 Z"
                                                                                    fill={color}
                                                                                    opacity="0.55"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        
                                                                        {/* Middle ring triangles */}
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 35,-30 L 20,-10 L 0,-20 Z"
                                                                                    fill={color}
                                                                                    opacity="0.9"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 60,0 L 20,-10 L 40,15 Z"
                                                                                    fill={color}
                                                                                    opacity="0.85"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 35,30 L 40,15 L 0,20 Z"
                                                                                    fill={color}
                                                                                    opacity="0.8"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 0,60 L 0,20 L -40,15 Z"
                                                                                    fill={color}
                                                                                    opacity="0.75"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M -35,30 L -40,15 L -20,-10 Z"
                                                                                    fill={color}
                                                                                    opacity="0.7"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M -60,0 L -20,-10 L 0,-20 Z"
                                                                                    fill={color}
                                                                                    opacity="0.65"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        
                                                                        {/* Lower ring triangles */}
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 20,-10 L 40,15 L 0,20 Z"
                                                                                    fill={color}
                                                                                    opacity="0.6"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 40,15 L 0,20 L -40,15 Z"
                                                                                    fill={color}
                                                                                    opacity="0.55"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 0,20 L -40,15 L -20,-10 Z"
                                                                                    fill={color}
                                                                                    opacity="0.5"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M -40,15 L -20,-10 L 0,-20 Z"
                                                                                    fill={color}
                                                                                    opacity="0.45"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M -20,-10 L 0,-20 L 20,-10 Z"
                                                                                    fill={color}
                                                                                    opacity="0.4"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 0,-20 L 20,-10 L 40,15 Z"
                                                                                    fill={color}
                                                                                    opacity="0.35"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                                        
                                                                        {/* Bottom cap triangle */}
                                                                        <path
                                                                                    className="triangle"
                                                                                    d="M 0,20 L -40,15 L 40,15 Z"
                                                                                    fill={color}
                                                                                    opacity="0.3"
                                                                                    stroke="white"
                                                                                    strokeWidth="1"
                                                                        />
                                                            </g>
                                                </svg>
                                    </div>
                        </div>
            );
};

export default IcosphereLoader;