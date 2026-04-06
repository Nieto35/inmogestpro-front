// src/components/UI/LoadingScreen.jsx
import { Building2 } from 'lucide-react';

const LoadingScreen = () => {
  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center gap-4"
      style={{ background: 'var(--color-bg-primary)' }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{
          background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
          boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
          animation: 'pulse 1.8s ease-in-out infinite',
        }}
      >
        <Building2 size={26} color="white" />
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
          InmoGest Pro
        </p>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: '#3b82f6',
                animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.4; }
          50%       { transform: translateY(-6px); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;