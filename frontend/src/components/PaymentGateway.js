import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { X, CreditCard, Smartphone, Building2, Check, Loader2, Shield, Lock } from 'lucide-react';

const PaymentGateway = ({ amount, onSuccess, onClose, doctorName, billBreakdown }) => {
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [upiId, setUpiId] = useState('');
  const [cardData, setCardData] = useState({
    number: '',
    expiry: '',
    cvv: '',
    name: ''
  });
  const [selectedBank, setSelectedBank] = useState('');

  const banks = [
    { id: 'sbi', name: 'State Bank of India', icon: '🏦' },
    { id: 'hdfc', name: 'HDFC Bank', icon: '🏦' },
    { id: 'icici', name: 'ICICI Bank', icon: '🏦' },
    { id: 'axis', name: 'Axis Bank', icon: '🏦' },
    { id: 'kotak', name: 'Kotak Mahindra', icon: '🏦' }
  ];

  const upiApps = [
    { id: 'gpay', name: 'Google Pay', color: 'bg-blue-500' },
    { id: 'phonepe', name: 'PhonePe', color: 'bg-purple-500' },
    { id: 'paytm', name: 'Paytm', color: 'bg-sky-500' },
    { id: 'bhim', name: 'BHIM', color: 'bg-green-600' }
  ];

  const generateChecksum = () => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `CHK${timestamp}${random}`.toUpperCase().slice(0, 20);
  };

  const generateTransactionId = () => {
    return `TXN${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  };

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : value;
  };

  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2, 4);
    }
    return v;
  };

  const handlePayment = async () => {
    setProcessing(true);
    
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const transactionId = generateTransactionId();
    const checksum = generateChecksum();
    
    setSuccess(true);
    setProcessing(false);
    
    // Wait a moment to show success, then callback
    setTimeout(() => {
      onSuccess({
        transactionId,
        checksum,
        amount,
        method: paymentMethod,
        timestamp: new Date().toISOString()
      });
    }, 1500);
  };

  const isFormValid = () => {
    if (paymentMethod === 'upi') {
      return upiId.includes('@');
    }
    if (paymentMethod === 'card') {
      return cardData.number.replace(/\s/g, '').length === 16 &&
             cardData.expiry.length === 5 &&
             cardData.cvv.length >= 3 &&
             cardData.name.length > 2;
    }
    if (paymentMethod === 'netbanking') {
      return selectedBank !== '';
    }
    return false;
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4">
        <Card className="w-full max-w-md bg-white dark:bg-slate-900 animate-in zoom-in-95 mx-2">
          <CardContent className="pt-6 sm:pt-8 pb-6 sm:pb-8 text-center px-4 sm:px-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-3 sm:mb-4">
              <Check className="w-8 h-8 sm:w-10 sm:h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400 mb-2">Payment Successful!</h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 mb-4">₹{amount} paid successfully</p>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3 text-xs sm:text-sm text-left break-all">
              <p><span className="text-slate-500">Transaction ID:</span> {generateTransactionId()}</p>
              <p className="mt-1"><span className="text-slate-500">Checksum:</span> {generateChecksum()}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 sm:p-4">
      <Card className="w-full max-w-lg bg-white dark:bg-slate-900 max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 sm:p-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <p className="text-xs sm:text-sm opacity-80">AyuMitraAI</p>
              <p className="font-bold text-base sm:text-lg">₹{amount}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Payment Info */}
        <div className="bg-slate-50 dark:bg-slate-800 px-3 sm:px-4 py-2 sm:py-3 border-b dark:border-slate-700">
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
            Consultation fee for Dr. {doctorName}
          </p>
          {billBreakdown && (
            <div className="mt-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span>Consultation</span>
                <span>₹{billBreakdown.consultation_fee}</span>
              </div>
              {billBreakdown.additional_charges?.map((charge, i) => (
                <div key={i} className="flex justify-between text-slate-500">
                  <span>{charge.name} {charge.quantity > 1 ? `×${charge.quantity}` : ''}</span>
                  <span>₹{charge.amount}</span>
                </div>
              ))}
              <div className="flex justify-between text-slate-500">
                <span>Platform Fee</span>
                <span>₹{billBreakdown.platform_fee}</span>
              </div>
            </div>
          )}
        </div>

        {/* Payment Methods */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
            {/* Method Tabs */}
            <div className="flex gap-1 sm:gap-2">
              {[
                { id: 'upi', label: 'UPI', icon: Smartphone },
                { id: 'card', label: 'Card', icon: CreditCard },
                { id: 'netbanking', label: 'Bank', icon: Building2 }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 rounded-lg border-2 transition flex flex-col items-center gap-1 ${
                    paymentMethod === method.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-600'
                      : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  <method.icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-xs sm:text-sm font-medium">{method.label}</span>
                </button>
              ))}
            </div>

            {/* UPI Section */}
            {paymentMethod === 'upi' && (
              <div className="space-y-3 sm:space-y-4">
                <div className="grid grid-cols-4 gap-1 sm:gap-2">
                  {upiApps.map(app => (
                    <button
                      key={app.id}
                      onClick={() => setUpiId(`user@${app.id}`)}
                      className={`p-2 sm:p-3 rounded-lg border text-center transition ${
                        upiId.includes(app.id)
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-8 h-8 sm:w-10 sm:h-10 ${app.color} rounded-full mx-auto mb-1 flex items-center justify-center text-white font-bold text-sm sm:text-base`}>
                        {app.name.charAt(0)}
                      </div>
                      <p className="text-[10px] sm:text-xs truncate">{app.name}</p>
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <p className="text-center text-xs sm:text-sm text-slate-500 my-2 sm:my-3">Or enter UPI ID</p>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">UPI ID</Label>
                  <Input
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="yourname@upi"
                    className="mt-1 h-10 sm:h-11 text-sm"
                  />
                </div>
              </div>
            )}

            {/* Card Section */}
            {paymentMethod === 'card' && (
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <Label className="text-xs sm:text-sm">Card Number</Label>
                  <Input
                    value={cardData.number}
                    onChange={(e) => setCardData({...cardData, number: formatCardNumber(e.target.value)})}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    className="mt-1 font-mono h-10 sm:h-11 text-sm"
                    inputMode="numeric"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <Label className="text-xs sm:text-sm">Expiry</Label>
                    <Input
                      value={cardData.expiry}
                      onChange={(e) => setCardData({...cardData, expiry: formatExpiry(e.target.value)})}
                      placeholder="MM/YY"
                      maxLength={5}
                      className="mt-1 h-10 sm:h-11 text-sm"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label className="text-xs sm:text-sm">CVV</Label>
                    <Input
                      type="password"
                      value={cardData.cvv}
                      onChange={(e) => setCardData({...cardData, cvv: e.target.value.replace(/\D/g, '').slice(0, 4)})}
                      placeholder="•••"
                      maxLength={4}
                      className="mt-1 h-10 sm:h-11 text-sm"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs sm:text-sm">Cardholder Name</Label>
                  <Input
                    value={cardData.name}
                    onChange={(e) => setCardData({...cardData, name: e.target.value.toUpperCase()})}
                    placeholder="NAME ON CARD"
                    className="mt-1 h-10 sm:h-11 text-sm"
                  />
                </div>
                <div className="flex items-center gap-2 text-[10px] sm:text-xs text-slate-500">
                  <Lock className="w-3 h-3" />
                  <span>Your card details are encrypted and secure</span>
                </div>
              </div>
            )}

            {/* Net Banking Section */}
            {paymentMethod === 'netbanking' && (
              <div className="space-y-2">
                <Label className="text-xs sm:text-sm">Select Your Bank</Label>
                {banks.map(bank => (
                  <button
                    key={bank.id}
                    onClick={() => setSelectedBank(bank.id)}
                    className={`w-full p-2.5 sm:p-3 rounded-lg border flex items-center gap-2 sm:gap-3 transition ${
                      selectedBank === bank.id
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="text-xl sm:text-2xl">{bank.icon}</span>
                    <span className="font-medium text-sm sm:text-base">{bank.name}</span>
                    {selectedBank === bank.id && (
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t dark:border-slate-700 p-3 sm:p-4 bg-slate-50 dark:bg-slate-800">
          <Button
            onClick={handlePayment}
            disabled={!isFormValid() || processing}
            className="w-full py-5 sm:py-6 text-base sm:text-lg font-semibold bg-blue-600 hover:bg-blue-700"
          >
            {processing ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>Pay ₹{amount}</>
            )}
          </Button>
          <div className="flex items-center justify-center gap-2 mt-2 sm:mt-3 text-[10px] sm:text-xs text-slate-500">
            <Lock className="w-3 h-3" />
            <span>Secured by 256-bit SSL encryption</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default PaymentGateway;
