'use client';

import { useState, useRef, useEffect } from 'react';
import { Button, Card } from '@/components/ui';

interface TwoFactorFormProps {
  onSubmit: (code: string) => Promise<void>;
  onResend?: () => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export function TwoFactorForm({ onSubmit, onResend, loading = false, error }: TwoFactorFormProps) {
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [resendTimer, setResendTimer] = useState(60);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    // Resend timer countdown
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only allow digits

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Only take the last digit
    setCode(newCode);

    // Auto-advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits entered
    if (newCode.every((digit) => digit) && newCode.join('').length === 6) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    pastedData.split('').forEach((char, i) => {
      if (i < 6) newCode[i] = char;
    });
    setCode(newCode);

    // Focus the next empty input or the last one
    const nextEmptyIndex = newCode.findIndex((digit) => !digit);
    if (nextEmptyIndex !== -1) {
      inputRefs.current[nextEmptyIndex]?.focus();
    } else {
      inputRefs.current[5]?.focus();
    }

    // Auto-submit if complete
    if (newCode.every((digit) => digit)) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleSubmit = async (codeString?: string) => {
    const finalCode = codeString || code.join('');
    if (finalCode.length === 6) {
      await onSubmit(finalCode);
    }
  };

  const handleResend = async () => {
    if (onResend && resendTimer === 0) {
      await onResend();
      setResendTimer(60);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Two-Factor Authentication</h2>
        <p className="text-gray-500 mt-1">Enter the 6-digit code from your authenticator app</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
          {error}
        </div>
      )}

      <div className="flex justify-center gap-2 mb-6">
        {code.map((digit, index) => (
          <input
            key={index}
            ref={(el) => { inputRefs.current[index] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            className="w-12 h-14 text-center text-xl font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            disabled={loading}
          />
        ))}
      </div>

      <Button
        onClick={() => handleSubmit()}
        loading={loading}
        className="w-full"
      >
        Verify
      </Button>

      {onResend && (
        <div className="mt-4 text-center">
          <button
            onClick={handleResend}
            disabled={resendTimer > 0}
            className="text-sm text-primary hover:underline disabled:text-gray-400 disabled:no-underline"
          >
            {resendTimer > 0 ? `Resend code in ${resendTimer}s` : 'Resend code'}
          </button>
        </div>
      )}
    </Card>
  );
}

export default TwoFactorForm;