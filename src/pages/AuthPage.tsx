import React, { useState } from 'react';
import { ArrowRight, KeyRound, RefreshCw } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { Button, Card, ErrorAlert, Field, InfoBanner, Modal, SuccessBanner, inputCls } from '../components/ui';
import { useCrm } from '../store/crmStore';
import { StaggerContainer, StaggerItem } from '../components/motion';

export const AuthPage: React.FC = () => {
  const { state, signIn, signInAsUser, resetDemoWorkspace } = useCrm();
  const [email, setEmail] = useState('manager@dexsales.demo');
  const [password, setPassword] = useState('demo');
  const [error, setError] = useState('');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSentMsg, setResetSentMsg] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const res = signIn(email, password);
    if (!res.ok) setError(res.error || 'Sign-in failed.');
  };

  const handleResetRequest = (e: React.FormEvent) => {
    e.preventDefault();
    setResetSentMsg(
      `In this demo there's no real email — every account uses the password "demo". Easiest option: click any account on the right to sign in instantly.`
    );
  };

  return (
    <div className="min-h-screen bg-[#F4F8FF] flex flex-col justify-center py-10 px-4 sm:px-6">
      <StaggerContainer className="max-w-4xl w-full mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Sign-in form */}
        <StaggerItem>
        <Card className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <BrandLogo size="md" />
            <div className="mt-6">
              <h1 className="text-xl font-semibold text-[#0A1936]">Sign in to DeX Sales</h1>
              <p className="text-sm text-[#3B5998] mt-1">
                Your sales workspace — customers, deals and follow-ups in one place.
              </p>
            </div>

            {error && (
              <div className="mt-4">
                <ErrorAlert message={error} onClose={() => setError('')} />
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <Field label="Work Email" required>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="name@company.com"
                  required
                />
              </Field>

              <Field label="Password" required>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="Enter password"
                  required
                />
              </Field>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setResetSentMsg('');
                    setResetOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#1D4ED8] hover:underline cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  Forgot password?
                </button>

                <Button type="submit">
                  Sign in
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </div>

          <div className="mt-8 pt-4 border-t border-[#DBEAFE] flex items-center justify-between text-xs text-[#3B5998]">
            <span>Static Vercel Demo · Browser persistence</span>
            <button
              type="button"
              onClick={resetDemoWorkspace}
              className="inline-flex items-center gap-1 font-medium text-[#1D4ED8] hover:underline cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              Reset demo
            </button>
          </div>
        </Card>
        </StaggerItem>

        {/* Right: 1-Click Demo Role Access */}
        <StaggerItem>
        <Card className="lg:col-span-6 p-6 sm:p-8 flex flex-col justify-between bg-white">
          <div>
            <InfoBanner
              title="Try a Demo Account"
              body="Sample data is loaded in this browser. Click an account below to sign in instantly — or use the password &ldquo;demo&rdquo;."
            />

            <div className="mt-5 space-y-2">
              {state.users
                .filter((u) => u.is_active)
                .map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => signInAsUser(u.id)}
                    className="w-full text-left px-4 py-3 rounded-lg border border-[#DBEAFE] hover:border-[#1D4ED8] hover:bg-[#EFF6FF] transition-colors flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#0A1936] truncate">{u.name}</div>
                      <div className="text-xs text-[#3B5998] truncate">{u.email}</div>
                    </div>
                    <span className="px-2.5 py-1 rounded-md bg-[#EFF6FF] border border-[#BFDBFE] text-xs font-medium text-[#1E40AF] shrink-0">
                      {u.role}
                    </span>
                  </button>
                ))}
            </div>
          </div>

          <p className="mt-5 text-xs text-[#3B5998] leading-relaxed">
            Role permissions and record visibility (including Partner Viewer isolation) are enforced across all lists, search, reports, exports, and briefs.
          </p>
        </Card>
        </StaggerItem>
      </StaggerContainer>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        title="Account & Password Recovery"
        subtitle="Demo password help"
      >
        {resetSentMsg ? (
          <div className="space-y-4">
            <SuccessBanner message={resetSentMsg} />
            <div className="flex justify-end">
              <Button onClick={() => setResetOpen(false)}>Close</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleResetRequest} className="space-y-4">
            <Field label="Account Email" required>
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Check Recovery Status</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
