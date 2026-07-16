import React from 'react';
import { motion } from 'framer-motion';
import loginLogo from '../assets/login-logo.png';

export const AppBootScreen: React.FC = () => (
  <div className="min-h-[100dvh] w-full bg-white flex flex-col items-center justify-center px-6">
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center text-center max-w-xs"
    >
      <img
        src={loginLogo}
        alt="Malcon Nexus"
        className="w-[180px] sm:w-[200px] object-contain mb-8"
      />
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-600" />
        </span>
        <p className="text-sm text-gray-500 font-medium">Getting things ready…</p>
      </div>
    </motion.div>
  </div>
);
