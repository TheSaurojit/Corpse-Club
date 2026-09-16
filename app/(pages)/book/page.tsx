'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  getAvailableDates,
  BookingDate,
  DurationMinutes,
  DURATION_OPTIONS,
  TimeBlockAvailability,
  calculateAvailabilityBlocks,
  fetchAvailabilityFromDb,
  formatDateDisplay,
  getPriceForDuration,
  generate6CharBookingId,
} from '@/lib/booking';
import {
  createDbBookingAction,
  getBookingHubInitialDataAction,
} from '@/actions/booking-actions';

export default function BookingHubPage() {
  const router = useRouter();
  const [isLoadingDates, setIsLoadingDates] = useState<boolean>(true);
  const [availableDates, setAvailableDates] = useState<BookingDate[]>([]);
  const [bookedSlotsCache, setBookedSlotsCache] = useState<Record<string, number[]>>({});
  const [holidayDatesCache, setHolidayDatesCache] = useState<string[]>([]);

  // Sync live slot availability counts across 5 calendar days from Neon PostgreSQL (single-roundtrip batch)
  useEffect(() => {
    setIsLoadingDates(true);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    getBookingHubInitialDataAction(5, todayStr)
      .then((data) => {
        if (data.success && data.dates.length > 0) {
          setAvailableDates(data.dates);
          setBookedSlotsCache(data.bookedSlotsByDate);
          setHolidayDatesCache(data.holidayDates);

          const defaultDate = data.dates[0].dateString;
          setSelectedDate((prev) => (prev && data.dates.some((d) => d.dateString === prev) ? prev : defaultDate));

          // Pre-calculate initial slot availability for Step 3 in memory with 0ms delay
          const targetDate = defaultDate;
          const isHoliday = data.holidayDates.includes(targetDate);
          const bookedIndices = data.bookedSlotsByDate[targetDate] || [];
          const initialBlocks = calculateAvailabilityBlocks(
            targetDate,
            40,
            bookedIndices,
            isHoliday,
            'fixed'
          );
          setAvailabilityResult(initialBlocks);
        } else {
          const fallback = getAvailableDates(5, [], todayStr);
          setAvailableDates(fallback);
          if (fallback.length > 0) setSelectedDate(fallback[0].dateString);
        }
      })
      .catch((err) => {
        console.error('Error fetching initial booking hub data:', err);
        const fallback = getAvailableDates(5, [], todayStr);
        setAvailableDates(fallback);
        if (fallback.length > 0) setSelectedDate(fallback[0].dateString);
      })
      .finally(() => {
        setIsLoadingDates(false);
      });
  }, []);

  // Modal Open State & Active Step (1: Date, 2: Minutes, 3: Time, 4: Hardware & Price, 5: Customer Details)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Wizard selections
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedDuration, setSelectedDuration] = useState<DurationMinutes | null>(40);
  const [selectedBlock, setSelectedBlock] = useState<TimeBlockAvailability | null>(null);
  const [selectedControllers, setSelectedControllers] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'fixed' | 'flexible'>('fixed');

  // Customer credentials
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Submitting and Result Modal States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [successModal, setSuccessModal] = useState<{
    isOpen: boolean;
    bookingId: string;
    customerName: string;
    customerPhone: string;
    date: string;
    formattedDate: string;
    timeRange: string;
    duration: string;
    controllers: number;
    totalPrice: number;
  } | null>(null);
  const [errorModal, setErrorModal] = useState<{
    isOpen: boolean;
    isSlotFilled: boolean;
    message: string;
  } | null>(null);

  // Database availability state
  const [isLoadingAvailability, setIsLoadingAvailability] = useState<boolean>(false);
  const [availabilityResult, setAvailabilityResult] = useState<{
    blocks: TimeBlockAvailability[];
    totalAvailable: number;
    totalBooked: number;
    dateString: string;
  } | null>(null);

  // Keyboard escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  // Load database availability with instant in-memory calculation if cached
  const loadAvailability = (
    dateStr: string,
    duration: DurationMinutes,
    mode: 'fixed' | 'flexible',
    customBookedMap?: Record<string, number[]>,
    customHolidays?: string[]
  ) => {
    const bookedMap = customBookedMap || bookedSlotsCache;
    const holidays = customHolidays || holidayDatesCache;
    const isHoliday = holidays.includes(dateStr);

    // If slot indices for this date are cached, compute immediately (0ms, 0 network requests)
    if (bookedMap[dateStr] !== undefined) {
      setIsLoadingAvailability(false);
      const res = calculateAvailabilityBlocks(dateStr, duration, bookedMap[dateStr], isHoliday, mode);
      setAvailabilityResult(res);
      return;
    }

    // Fallback network fetch if date is outside initial batch
    setIsLoadingAvailability(true);
    setSelectedBlock(null);
    fetchAvailabilityFromDb(dateStr, duration, mode)
      .then((res) => {
        setAvailabilityResult(res);
      })
      .finally(() => {
        setIsLoadingAvailability(false);
      });
  };

  // Open modal with pre-selected date
  const handleOpenModalWithDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setCurrentStep(1);
    setIsModalOpen(true);
    if (selectedDuration) {
      loadAvailability(dateStr, selectedDuration, viewMode);
    }
  };

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setSelectedBlock(null);
    if (selectedDuration) {
      loadAvailability(dateStr, selectedDuration, viewMode);
    }
  };

  const handleSelectDuration = (duration: DurationMinutes) => {
    setSelectedDuration(duration);
    setSelectedBlock(null);
    if (selectedDate) {
      loadAvailability(selectedDate, duration, viewMode);
    }
  };

  const handleToggleViewMode = () => {
    const nextMode = viewMode === 'fixed' ? 'flexible' : 'fixed';
    setViewMode(nextMode);
    if (selectedDate && selectedDuration) {
      loadAvailability(selectedDate, selectedDuration, nextMode);
    }
  };

  const calculatedTotalPrice = selectedDuration
    ? getPriceForDuration(selectedDuration, selectedControllers)
    : 0;

  // Step Validation & Navigation
  const handleNextStep = () => {
    setErrorMessage('');
    if (currentStep === 1) {
      if (!selectedDate) {
        setErrorMessage('Please select a booking date.');
        return;
      }
      setCurrentStep(2);
      return;
    }

    if (currentStep === 2) {
      if (!selectedDuration) {
        setErrorMessage('Please choose session duration.');
        return;
      }
      if (!availabilityResult) {
        loadAvailability(selectedDate, selectedDuration, viewMode);
      }
      setCurrentStep(3);
      return;
    }

    if (currentStep === 3) {
      if (!selectedBlock) {
        setErrorMessage('Please select an available time slot.');
        return;
      }
      setCurrentStep(4);
      return;
    }

    if (currentStep === 4) {
      if (!selectedControllers) {
        setErrorMessage('Please choose number of controllers.');
        return;
      }
      setCurrentStep(5);
      return;
    }
  };

  const handlePrevStep = () => {
    setErrorMessage('');
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleCopyCode = (code: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleCloseErrorAndPickSlot = () => {
    setErrorModal(null);
    setCurrentStep(3);
    if (!isModalOpen) {
      setIsModalOpen(true);
    }
    if (selectedDate && selectedDuration) {
      loadAvailability(selectedDate, selectedDuration, viewMode);
    }
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBlock || !selectedDate || !selectedDuration || isSubmitting) return;

    if (!customerName.trim()) {
      setErrorMessage('Please enter your full name / gamer tag.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Please enter a valid 10-digit phone number.');
      return;
    }
    if (!customerEmail.trim() || !customerEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    // Past date check
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
    if (selectedDate < todayStr) {
      setErrorMessage(`Cannot book for a past date (${selectedDate}). Today is ${todayStr}.`);
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    // 1. Generate unique 6-character alphanumeric booking ID
    const bookingId = generate6CharBookingId();
    const formattedDate = formatDateDisplay(selectedDate);
    const timeRange = `${selectedBlock.startTime} - ${selectedBlock.endTime}`;
    const durationOption = DURATION_OPTIONS.find((d) => d.value === selectedDuration);
    const durationLabel = durationOption ? durationOption.label : `${selectedDuration} Mins`;

    try {
      // 2. Strict concurrency duplicate verification & atomic DB insertion
      const result = await createDbBookingAction({
        id: bookingId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim(),
        bookingDate: selectedDate,
        startTime: selectedBlock.startTime,
        endTime: selectedBlock.endTime,
        durationMins: selectedDuration,
        controllers: selectedControllers,
        totalPrice: calculatedTotalPrice,
        slotIndices: selectedBlock.slotIndices,
      });

      if (result.success && result.bookingId) {
        const finalBookingId = result.bookingId;

        // Store reservation details in localStorage for offline / pass caching
        const bookingDetails = {
          bookingId: finalBookingId,
          date: selectedDate,
          formattedDate,
          startTime: selectedBlock.startTime,
          endTime: selectedBlock.endTime,
          durationHours: `${selectedDuration} Mins`,
          players: selectedControllers,
          totalPrice: calculatedTotalPrice,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          customerEmail: customerEmail.trim(),
          timestamp: new Date().toISOString(),
        };

        try {
          localStorage.setItem(`booking_${finalBookingId}`, JSON.stringify(bookingDetails));
        } catch {
          // Ignore localStorage errors
        }

        // Close wizard modal and trigger Success Popup
        setIsModalOpen(false);
        setSuccessModal({
          isOpen: true,
          bookingId: finalBookingId,
          customerName: customerName.trim(),
          customerPhone: customerPhone.trim(),
          date: selectedDate,
          formattedDate,
          timeRange,
          duration: durationLabel,
          controllers: selectedControllers,
          totalPrice: calculatedTotalPrice,
        });

        // Re-sync slot availability so background view updates in 1 round-trip
        getBookingHubInitialDataAction(5).then((data) => {
          if (data.success) {
            setAvailableDates(data.dates);
            setBookedSlotsCache(data.bookedSlotsByDate);
            setHolidayDatesCache(data.holidayDates);
            if (selectedDate && selectedDuration) {
              loadAvailability(selectedDate, selectedDuration, viewMode, data.bookedSlotsByDate, data.holidayDates);
            }
          }
        });
      } else {
        // Slot collision or booking error -> trigger Error Popup
        if (result.isSlotFilled) {
          setErrorModal({
            isOpen: true,
            isSlotFilled: true,
            message:
              result.error ||
              `The slot (${timeRange}) on ${formattedDate} has already been booked by another player.`,
          });
          // Refresh live slot availability immediately in 1 round-trip
          getBookingHubInitialDataAction(5).then((data) => {
            if (data.success) {
              setAvailableDates(data.dates);
              setBookedSlotsCache(data.bookedSlotsByDate);
              setHolidayDatesCache(data.holidayDates);
              if (selectedDate && selectedDuration) {
                loadAvailability(selectedDate, selectedDuration, viewMode, data.bookedSlotsByDate, data.holidayDates);
              }
            }
          });
        } else {
          setErrorModal({
            isOpen: true,
            isSlotFilled: false,
            message: result.error || 'Failed to complete reservation. Please try again.',
          });
        }
      }
    } catch (err: unknown) {
      console.error('Booking submission error:', err);
      setErrorModal({
        isOpen: true,
        isSlotFilled: false,
        message: err instanceof Error ? err.message : 'Network error occurred while reserving your slot.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-14 py-12 sm:py-16 space-y-16 pb-36">
      
      {/* HUB HEADER */}
      <div className="space-y-4 border-b border-[var(--g200)] pb-8">
        <div className="flex items-center gap-3 text-xs font-mono text-[var(--red)] uppercase tracking-wider">
          <Link href="/" className="text-[var(--g400)] hover:text-white transition-colors cursor-none">
            ← / Return to Arena Hub
          </Link>
          <span className="text-[var(--g300)]">|</span>
          <span>DISPATCH TERMINAL // PS5 4K 120HZ OLED</span>
        </div>

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1
              style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em', lineHeight: 0.9 }}
              className="text-4xl sm:text-6xl lg:text-7xl font-black uppercase text-white m-0"
            >
              BOOK YOUR <span className="text-[var(--red)]">STATION</span>
            </h1>
            <p className="text-sm sm:text-base text-[var(--g400)] max-w-2xl font-sans mt-3">
              Operating on continuous 20-minute reservation blocks daily from 12:00 PM to 10:00 PM. Bookings open for today and the next 4 days (5-day rolling window).
            </p>
          </div>

          <button
            disabled={isLoadingDates}
            onClick={() => handleOpenModalWithDate(selectedDate || availableDates[0]?.dateString || '')}
            className={`px-8 py-4 rounded-full bg-[var(--red)] text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-none flex items-center gap-2 whitespace-nowrap self-start md:self-auto ${
              isLoadingDates
                ? 'opacity-60 cursor-wait'
                : 'shadow-[0_0_25px_rgba(255,0,0,0.6)] hover:shadow-[0_0_35px_rgba(255,0,0,0.9)] active:scale-95'
            }`}
          >
            <span>{isLoadingDates ? 'SYNCING CALENDAR...' : 'LAUNCH BOOKING MODAL'}</span>
            <span>→</span>
          </button>
        </div>
      </div>

      {/* 5 DAYS TEASER CARDS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between font-mono text-xs text-[var(--g400)]">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isLoadingDates ? 'bg-amber-400 animate-ping' : 'bg-[var(--red)] animate-pulse'
              }`}
            />
            <span className="text-white font-bold uppercase">AVAILABLE BOOKING DAYS</span>
            <span>{isLoadingDates ? '(CHECKING HOLIDAYS & AVAILABILITY...)' : '(NEXT 5 DAYS)'}</span>
          </div>
          <span className="text-[var(--red)] font-bold">
            {isLoadingDates ? 'SYNCHRONIZING...' : 'CLICK TO RESERVE'}
          </span>
        </div>

        {isLoadingDates ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="p-4 sm:p-5 rounded border border-[var(--g200)] bg-[#080808]/70 flex flex-col justify-between h-44 sm:h-48 animate-pulse font-mono"
              >
                <div className="flex items-center justify-between w-full">
                  <div className="w-10 h-3 rounded bg-[var(--g200)]/60" />
                  <div className="w-12 h-3.5 rounded bg-[var(--g200)]/40" />
                </div>
                <div className="space-y-2 my-auto">
                  <div className="w-12 h-10 rounded bg-[var(--g200)]/40" />
                  <div className="w-10 h-2.5 rounded bg-[var(--g200)]/30" />
                </div>
                <div className="pt-2 sm:pt-3 border-t border-[var(--g200)]/40 flex items-center justify-between">
                  <div className="w-14 h-2.5 rounded bg-[var(--g200)]/30" />
                  <div className="w-12 h-2.5 rounded bg-[var(--red)]/40" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {availableDates.map((item: BookingDate) => (
              <button
                key={item.dateString}
                onClick={() => handleOpenModalWithDate(item.dateString)}
                className="p-4 sm:p-5 rounded border border-[var(--g200)] bg-[#080808] hover:bg-[#121212] hover:border-[var(--red)] text-left transition-all duration-200 relative group flex flex-col justify-between h-44 sm:h-48 cursor-none shadow-lg"
              >
                <div className="flex items-center justify-between w-full font-mono">
                  <span className="text-xs uppercase font-bold text-[var(--g400)] group-hover:text-[var(--red)] transition-colors">
                    {item.dayName}
                  </span>
                  {item.isToday ? (
                    <span className="px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-bold bg-[var(--red)] text-white uppercase">
                      TODAY
                    </span>
                  ) : item.isWeekend ? (
                    <span className="px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-mono bg-[var(--g100)] text-[var(--g400)] border border-[var(--g200)]">
                      WEEKEND
                    </span>
                  ) : (
                    <span className="px-1.5 sm:px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-mono text-[var(--g400)] border border-[var(--g200)]">
                      OPEN
                    </span>
                  )}
                </div>

                <div>
                  <div
                    style={{ fontFamily: 'var(--font-display)' }}
                    className="text-4xl sm:text-5xl lg:text-6xl font-black text-white group-hover:text-[var(--red)] transition-colors"
                  >
                    {item.dayNumber}
                  </div>
                  <div className="text-[11px] font-mono text-[var(--g400)] uppercase mt-0.5">
                    {item.monthName}
                  </div>
                </div>

                <div className="pt-2 sm:pt-3 border-t border-[var(--g200)] flex items-center justify-between text-[10px] sm:text-[11px] font-mono w-full text-[var(--g400)] group-hover:text-white transition-colors">
                  <span className="hidden sm:inline">12 PM – 10 PM</span>
                  <span className="sm:hidden">{item.availableCount !== undefined ? `${item.availableCount} Open` : '12-10 PM'}</span>
                  <span className="font-bold text-[var(--red)]">Reserve →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* OFFICIAL INR PRICING REFERENCE TABLE */}
      <div className="p-6 sm:p-8 rounded-2xl border border-[var(--g200)] bg-[#070707] space-y-6 font-mono">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--g200)] pb-4">
          <div>
            <div className="text-xs text-[var(--red)] uppercase font-bold">
              {'// OFFICIAL CORPSE CLUB INR RATE CARD'}
            </div>
            <div className="text-sm text-white font-bold mt-0.5">
              Transparent Session Pricing for Solo & Duo Controllers
            </div>
          </div>
          <span className="text-[10px] text-[var(--g400)] uppercase">ALL TAXES & HARDWARE INCLUDED</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1 Controller */}
          <div className="p-5 rounded border border-[var(--g200)] bg-[#0c0c0c] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--g200)] pb-2">
              <span className="font-bold text-white uppercase text-sm">1 CONTROLLER (SOLO)</span>
              <span className="text-[10px] text-[var(--red)] font-bold">TIER A</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between p-2 rounded bg-black border border-[#1a1a1a]">
                <span className="text-[var(--g400)]">20 Mins Session</span>
                <span className="font-bold text-white">₹60 INR</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black border border-[#1a1a1a]">
                <span className="text-[var(--g400)]">40 Mins Session</span>
                <span className="font-bold text-white">₹130 INR</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black border border-[#1a1a1a]">
                <span className="text-[var(--g400)]">60 Mins (1 Hour)</span>
                <span className="font-bold text-white">₹150 INR</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black border border-[#1a1a1a]">
                <span className="text-[var(--g400)]">120 Mins (2 Hours)</span>
                <span className="font-bold text-white">₹300 INR</span>
              </div>
            </div>
          </div>

          {/* 2 Controllers */}
          <div className="p-5 rounded border border-[var(--g200)] bg-[#0c0c0c] space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--g200)] pb-2">
              <span className="font-bold text-white uppercase text-sm">2 CONTROLLER (DUO)</span>
              <span className="text-[10px] text-[var(--red)] font-bold">TIER B</span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between p-2 rounded bg-black border border-[#1a1a1a]">
                <span className="text-[var(--g400)]">20 Mins Session</span>
                <span className="font-bold text-white">₹110 INR</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black border border-[#1a1a1a]">
                <span className="text-[var(--g400)]">40 Mins Session</span>
                <span className="font-bold text-white">₹180 INR</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black border border-[#1a1a1a]">
                <span className="text-[var(--g400)]">60 Mins (1 Hour)</span>
                <span className="font-bold text-white">₹200 INR</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-black border border-[#1a1a1a]">
                <span className="text-[var(--g400)]">120 Mins (2 Hours)</span>
                <span className="font-bold text-white">₹400 INR</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* UNIFIED ALL-IN-ONE BOOKING MODAL WIZARD */}
      {/* ========================================================================= */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
          
          <div
            className="w-full max-w-4xl max-h-[92vh] flex flex-col bg-[#070707] border border-[var(--g200)] rounded-2xl shadow-[0_0_60px_rgba(255,0,0,0.3)] overflow-hidden font-mono text-xs relative animate-scaleUp"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* MODAL HEADER WITH STEP WIZARD BAR */}
            <div className="p-5 sm:p-6 border-b border-[var(--g200)] bg-[#0b0b0b] space-y-4 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[var(--red)] animate-pulse" />
                  <span className="text-white font-bold uppercase tracking-wider text-xs sm:text-sm">
                    ARENA BOOKING TERMINAL // CC-SHARD-01
                  </span>
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1 rounded bg-[#160608] text-[var(--red)] border border-[var(--red)]/40 hover:bg-[var(--red)] hover:text-white transition-all text-[11px] font-bold cursor-none"
                >
                  ESC / CLOSE ✕
                </button>
              </div>

              {/* Step Progression Bar */}
              <div className="grid grid-cols-5 gap-1 sm:gap-2">
                {[
                  { num: 1, label: 'DATE' },
                  { num: 2, label: 'MINUTES' },
                  { num: 3, label: 'TIME' },
                  { num: 4, label: 'HARDWARE' },
                  { num: 5, label: 'DETAILS' },
                ].map((s) => {
                  const isActive = currentStep === s.num;
                  const isDone = currentStep > s.num;

                  return (
                    <button
                      key={s.num}
                      onClick={() => {
                        if (isDone || (s.num === 1 && selectedDate)) {
                          setCurrentStep(s.num);
                        }
                      }}
                      disabled={!isDone && currentStep !== s.num}
                      className={`py-1.5 px-1 sm:px-3 rounded border text-center transition-all ${
                        isActive
                          ? 'bg-[var(--red)] text-white border-[var(--red)] font-bold shadow-[0_0_12px_rgba(255,0,0,0.5)]'
                          : isDone
                          ? 'bg-[#18080a] text-[var(--red)] border-[var(--red)]/40 cursor-none'
                          : 'bg-[#111] text-[var(--g400)] border-[#222] cursor-not-allowed opacity-50'
                      }`}
                    >
                      <div className="text-[10px] sm:text-xs">
                        {isDone ? '✓' : `0${s.num}`} {s.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MODAL BODY (SCROLLABLE CONTENT FOR ACTIVE STEP) */}
            <div className="p-5 sm:p-7 overflow-y-auto flex-1 space-y-6">
              
              {errorMessage && (
                <div className="p-3 rounded bg-[#1a0507] border border-[var(--red)] text-[var(--red)] font-mono text-xs">
                  ⚠ {errorMessage}
                </div>
              )}

              {/* STEP 1: DATE SELECTION */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white uppercase">
                        STEP 01 // CHOOSE BOOKING DATE
                      </h3>
                      <p className="text-[11px] text-[var(--g400)] mt-0.5 font-sans">
                        Reservations are open for today and the next 4 days (5-day rolling window).
                      </p>
                    </div>
                    <span className="text-[10px] text-[var(--red)] uppercase">5 DAYS AVAILABLE</span>
                  </div>

                  {isLoadingDates ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className="p-3 sm:p-4 rounded-xl border border-[var(--g200)] bg-[#0b0b0b] flex flex-col justify-between h-36 sm:h-40 animate-pulse font-mono"
                        >
                          <div className="w-8 h-3 rounded bg-[var(--g200)]/60" />
                          <div className="space-y-1.5 my-auto">
                            <div className="w-10 h-8 rounded bg-[var(--g200)]/40" />
                            <div className="w-8 h-2.5 rounded bg-[var(--g200)]/30" />
                          </div>
                          <div className="pt-2 border-t border-[var(--g200)]/40 flex items-center justify-between">
                            <div className="w-10 h-2.5 rounded bg-[var(--g200)]/30" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-3">
                      {availableDates.map((item: BookingDate) => {
                        const isSelected = selectedDate === item.dateString;

                      return (
                        <button
                          key={item.dateString}
                          onClick={() => {
                            handleSelectDate(item.dateString);
                          }}
                          className={`p-3 sm:p-4 rounded-xl border text-left transition-all relative flex flex-col justify-between h-36 sm:h-40 cursor-none ${
                            isSelected
                              ? 'bg-[#18080a] border-[var(--red)] shadow-[0_0_25px_rgba(255,0,0,0.4)] scale-[1.01]'
                              : 'bg-[#0b0b0b] border-[var(--g200)] hover:border-[var(--g300)] hover:bg-[#121212]'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className={`uppercase font-bold text-xs ${isSelected ? 'text-[var(--red)]' : 'text-[var(--g400)]'}`}>
                              {item.dayName}
                            </span>
                            {item.isToday ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] bg-[var(--red)] text-white font-bold">
                                TODAY
                              </span>
                            ) : item.isWeekend ? (
                              <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] bg-[var(--g100)] text-[var(--g400)]">
                                WKND
                              </span>
                            ) : null}
                          </div>

                          <div>
                            <div
                              style={{ fontFamily: 'var(--font-display)' }}
                              className={`text-3xl sm:text-4xl lg:text-5xl font-black ${isSelected ? 'text-[var(--red)]' : 'text-white'}`}
                            >
                              {item.dayNumber}
                            </div>
                            <div className="text-[10px] sm:text-[11px] font-mono text-[var(--g400)] uppercase mt-0.5">
                              {item.monthName}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[var(--g200)] flex items-center justify-between text-[10px]">
                            <span className="text-[var(--g400)] text-[9px] sm:text-[10px]">12-10 PM</span>
                            <span className={isSelected ? 'text-[var(--red)] font-bold' : 'text-[var(--g400)]'}>
                              {isSelected ? '✓' : 'SELECT'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  )}
                </div>
              )}

              {/* STEP 2: DURATION / MINUTES SELECTION */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-white uppercase">
                        STEP 02 // CHOOSE SESSION MINUTES
                      </h3>
                      <p className="text-[11px] text-[var(--g400)] mt-0.5 font-sans">
                        Only these 4 verified time duration presets are supported for PS5 console pods.
                      </p>
                    </div>
                    <span className="text-[10px] text-[var(--red)] font-bold">
                      {formatDateDisplay(selectedDate)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {DURATION_OPTIONS.map((opt) => {
                      const isSelected = selectedDuration === opt.value;

                      return (
                        <button
                          key={opt.value}
                          onClick={() => handleSelectDuration(opt.value)}
                          className={`p-5 rounded-xl border text-left transition-all relative flex flex-col justify-between h-36 cursor-none ${
                            isSelected
                              ? 'bg-[#18080a] border-[var(--red)] shadow-[0_0_25px_rgba(255,0,0,0.5)] scale-[1.02]'
                              : 'bg-[#0b0b0b] border-[var(--g200)] hover:border-[var(--g300)] hover:bg-[#121212]'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[9px] uppercase px-2 py-0.5 rounded bg-[var(--g100)] text-[var(--g400)]">
                              {opt.badge}
                            </span>
                            {isSelected && (
                              <span className="text-[10px] font-bold text-[var(--red)]">ACTIVE ✓</span>
                            )}
                          </div>

                          <div>
                            <div
                              style={{ fontFamily: 'var(--font-display)' }}
                              className={`text-3xl font-black uppercase ${isSelected ? 'text-[var(--red)]' : 'text-white'}`}
                            >
                              {opt.label}
                            </div>
                            <div className="text-[10px] text-[var(--g400)] mt-0.5 font-sans">
                              {opt.description}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-[var(--g200)] flex items-center justify-between text-[10px] text-[var(--g400)]">
                            <span>{opt.slotsCount * 20} Mins</span>
                            <span className={isSelected ? 'text-[var(--red)] font-bold' : ''}>
                              {isSelected ? 'SELECTED' : 'CHOOSE →'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: REAL-TIME TIME SLOTS FROM DATABASE */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-bold text-white uppercase">
                        STEP 03 // REAL-TIME ARENA TIME SLOTS
                      </h3>
                      <p className="text-[11px] text-[var(--g400)] mt-0.5">
                        Displaying slot availability starting from 12:00 PM on {formatDateDisplay(selectedDate)} for {selectedDuration} Mins.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleToggleViewMode}
                        className="px-2.5 py-1 rounded bg-[#160608] text-[var(--red)] border border-[var(--red)]/40 hover:bg-[var(--red)] hover:text-white transition-all text-[10px] cursor-none"
                      >
                        {viewMode === 'fixed' ? 'MODE: STANDARD BLOCKS' : 'MODE: ALL START TIMES (20M)'}
                      </button>
                    </div>
                  </div>

                  {isLoadingAvailability ? (
                    <div className="p-10 rounded border border-[var(--g200)] bg-[#0c0c0c] text-center space-y-3">
                      <div className="w-8 h-8 mx-auto border-2 border-[var(--red)] border-t-transparent rounded-full animate-spin" />
                      <div className="text-white font-bold uppercase">QUERYING ARENA DATABASE...</div>
                      <div className="text-[10px] text-[var(--g400)]">Retrieving real-time reservations for {selectedDate}</div>
                    </div>
                  ) : availabilityResult ? (
                    <div className="space-y-3">
                      <div className="p-2.5 rounded bg-[#0b0b0b] border border-[var(--g200)] flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-3">
                          <span className="text-emerald-400 font-bold">● {availabilityResult.totalAvailable} Open</span>
                          <span className="text-[var(--g400)]">● {availabilityResult.totalBooked} Booked</span>
                        </div>
                        <span className="text-[var(--g400)] text-[10px]">12:00 PM – 10:00 PM Slots</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1">
                        {availabilityResult.blocks.map((block) => {
                          const isSelected = selectedBlock?.id === block.id;
                          const isAvailable = block.isAvailable;

                          return (
                            <button
                              key={block.id}
                              disabled={!isAvailable}
                              onClick={() => setSelectedBlock(block)}
                              className={`p-3 rounded border text-left transition-all flex flex-col justify-between h-24 cursor-none ${
                                !isAvailable
                                  ? 'bg-[#0f0f0f] border-[#1f1f1f] text-[#444] cursor-not-allowed line-through opacity-50'
                                  : isSelected
                                  ? 'bg-[var(--red)] border-[var(--red)] text-white shadow-[0_0_20px_rgba(255,0,0,0.6)] font-bold'
                                  : 'bg-[#0b0b0b] border-[var(--g200)] text-white hover:border-[var(--red)] hover:bg-[#15080a]'
                              }`}
                            >
                              <div className="flex items-start justify-between w-full">
                                <div>
                                  <div className="text-xs sm:text-sm font-bold">{block.startTime}</div>
                                  <div className="text-[10px] opacity-75">until {block.endTime}</div>
                                </div>
                                <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold ${
                                  !isAvailable
                                    ? 'bg-[#1a1a1a] text-[#555]'
                                    : isSelected
                                    ? 'bg-black text-white'
                                    : 'bg-[#1c080a] text-[var(--red)] border border-[var(--red)]/40'
                                }`}>
                                  {!isAvailable ? 'BOOKED' : isSelected ? 'CHOSEN ✓' : 'OPEN'}
                                </span>
                              </div>

                              <div className="pt-1.5 border-t border-[var(--g200)]/40 flex items-center justify-between text-[9px] opacity-80">
                                <span>{block.durationLabel}</span>
                                <span>Slot #{String(block.slotIndices[0] + 1).padStart(2, '0')}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* STEP 4: HARDWARE & INR PRICING MATRIX */}
              {currentStep === 4 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <h3 className="text-base font-bold text-white uppercase">
                      STEP 04 // SELECT CONTROLLERS & CONFIRM PRICE
                    </h3>
                    <p className="text-[11px] text-[var(--g400)] mt-0.5">
                      Select 1 or 2 DualSense Wireless Controllers. Rates are displayed in INR.
                    </p>
                  </div>

                  {/* Controller Toggle Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => setSelectedControllers(1)}
                      className={`p-5 rounded-xl border text-left transition-all cursor-none ${
                        selectedControllers === 1
                          ? 'bg-[#18080a] border-[var(--red)] shadow-[0_0_25px_rgba(255,0,0,0.4)]'
                          : 'bg-[#0b0b0b] border-[var(--g200)] hover:bg-[#121212]'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--red)] font-bold">SOLO GAMER</span>
                        {selectedControllers === 1 && <span className="text-white font-bold">SELECTED ✓</span>}
                      </div>
                      <div className="text-2xl font-black text-white uppercase mt-1">1 CONTROLLER</div>
                      <div className="text-[11px] text-[var(--g400)] mt-1 font-sans">
                        1 DualSense Controller allocation. Single player story & campaigns.
                      </div>
                      <
                        div className="mt-3 pt-3 border-t border-[var(--g200)] flex justify-between items-center">
                        <span className="text-[var(--g400)]">For {selectedDuration} Mins</span>
                        <span className="text-xl font-bold text-white">
                          ₹{selectedDuration ? getPriceForDuration(selectedDuration, 1) : 60} INR
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => setSelectedControllers(2)}
                      className={`p-5 rounded-xl border text-left transition-all cursor-none ${
                        selectedControllers === 2
                          ? 'bg-[#18080a] border-[var(--red)] shadow-[0_0_25px_rgba(255,0,0,0.4)]'
                          : 'bg-[#0b0b0b] border-[var(--g200)] hover:bg-[#121212]'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--red)] font-bold">DUO CO-OP / VS</span>
                        {selectedControllers === 2 && <span className="text-white font-bold">SELECTED ✓</span>}
                      </div>
                      <div className="text-2xl font-black text-white uppercase mt-1">2 CONTROLLER</div>
                      <div className="text-[11px] text-[var(--g400)] mt-1 font-sans">
                        2 DualSense Controllers. Perfect for FC 25, Tekken 8, and Mortal Kombat.
                      </div>
                      <div className="mt-3 pt-3 border-t border-[var(--g200)] flex justify-between items-center">
                        <span className="text-[var(--g400)]">For {selectedDuration} Mins</span>
                        <span className="text-xl font-bold text-white">
                          ₹{selectedDuration ? getPriceForDuration(selectedDuration, 2) : 110} INR
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* INR Price Table Breakdown for Chosen Tier */}
                  {/* <div className="p-4 rounded-xl border border-[var(--g200)] bg-[#090909] space-y-3">
                    <div className="flex items-center justify-between text-xs border-b border-[var(--g200)] pb-2">
                      <span className="text-white font-bold uppercase">
                        {selectedControllers} CONTROLLER RATE MATRIX (INR)
                      </span>
                      <span className="text-[var(--red)] font-bold">OFFICIAL RATES</span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      {(selectedControllers === 1
                        ? [
                            { m: 20, p: 60, l: '20 Mins' },
                            { m: 40, p: 130, l: '40 Mins' },
                            { m: 60, p: 150, l: '60 Mins (1h)' },
                            { m: 120, p: 300, l: '120 Mins (2h)' },
                          ]
                        : [
                            { m: 20, p: 110, l: '20 Mins' },
                            { m: 40, p: 180, l: '40 Mins' },
                            { m: 60, p: 200, l: '60 Mins (1h)' },
                            { m: 120, p: 400, l: '120 Mins (2h)' },
                          ]
                      ).map((row) => {
                        const isMatch = selectedDuration === row.m;

                        return (
                          <div
                            key={row.m}
                            className={`p-3 rounded border flex flex-col justify-between ${
                              isMatch
                                ? 'bg-[var(--red)] text-white border-[var(--red)] font-bold shadow-[0_0_12px_rgba(255,0,0,0.5)]'
                                : 'bg-black border-[#1a1a1a] text-[var(--g400)]'
                            }`}
                          >
                            <span className="text-[10px] uppercase opacity-80">{row.l}</span>
                            <span className="text-base font-bold mt-1">₹{row.p} INR</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pt-2 flex items-center justify-between text-[11px] text-[var(--g400)]">
                      <span>Rate Locked:</span>
                      <span className="text-white font-bold text-sm">
                        Total Due: <span className="text-[var(--red)] text-base">₹{calculatedTotalPrice} INR</span>
                      </span>
                    </div>
                  </div> */}
                </div>
              )}

              {/* STEP 5: CUSTOMER DETAILS & FINAL PASS SUMMARY */}
              {currentStep === 5 && (
                <div className="space-y-5 animate-fadeIn">
                  <div>
                    <h3 className="text-base font-bold text-white uppercase">
                      STEP 05 // ENTER CUSTOMER DETAILS
                    </h3>
                    <p className="text-[11px] text-[var(--g400)] mt-0.5">
                      Enter your contact credentials to lock your station and generate your 6-character pass.
                    </p>
                  </div>

                  {/* Summary Ticket */}
                  <div className="p-4 rounded-xl border border-[var(--g200)] bg-[#0b0b0b] grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[var(--g400)]">Date:</span>
                      <div className="font-bold text-white mt-0.5">{formatDateDisplay(selectedDate)}</div>
                    </div>
                    <div>
                      <span className="text-[var(--g400)]">Time:</span>
                      <div className="font-bold text-[var(--red)] mt-0.5">
                        {selectedBlock?.startTime} → {selectedBlock?.endTime}
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--g400)]">Session:</span>
                      <div className="font-bold text-white mt-0.5">
                        {selectedDuration} Mins ({selectedControllers} Controller{selectedControllers > 1 ? 's' : ''})
                      </div>
                    </div>
                    <div>
                      <span className="text-[var(--g400)]">Amount:</span>
                      <div className="font-black text-[var(--red)] text-sm mt-0.5">₹{calculatedTotalPrice} INR</div>
                    </div>
                  </div>

                  {/* Instant Reservation Banner */}
                  <div className="p-3.5 rounded-lg bg-[#07131e] border border-[#0f3454] text-[11px] text-[#38bdf8] flex items-center gap-2.5">
                    <span className="text-base shrink-0">⚡</span>
                    <span>Clicking <strong>BOOK SLOT</strong> locks your station in real-time and issues your 6-character Digital Arena Pass.</span>
                  </div>

                  {/* Input Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs uppercase font-bold text-white mb-1">
                        Full Name / Gamer Tag <span className="text-[var(--red)]">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Alex Mercer"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg bg-black border border-[var(--g200)] text-white text-xs font-mono focus:outline-none focus:border-[var(--red)] cursor-none"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs uppercase font-bold text-white mb-1">
                          Phone Number <span className="text-[var(--red)]">*</span>
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 9876543210"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-black border border-[var(--g200)] text-white text-xs font-mono focus:outline-none focus:border-[var(--red)] cursor-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs uppercase font-bold text-white mb-1">
                          Email Address <span className="text-[var(--red)]">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          placeholder="e.g. alex@example.com"
                          value={customerEmail}
                          onChange={(e) => setCustomerEmail(e.target.value)}
                          className="w-full px-4 py-3 rounded-lg bg-black border border-[var(--g200)] text-white text-xs font-mono focus:outline-none focus:border-[var(--red)] cursor-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* MODAL FOOTER WITH TELEMETRY & NAVIGATION */}
            <div className="p-4 sm:p-5 border-t border-[var(--g200)] bg-[#090909] flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
              
              {/* Telemetry pill */}
              <div className="text-[11px] text-[var(--g400)] flex items-center gap-2 w-full sm:w-auto overflow-hidden">
                <span className="w-2 h-2 rounded-full bg-[var(--red)] shrink-0" />
                <span className="truncate">
                  {formatDateDisplay(selectedDate)}
                  {selectedDuration ? ` · ${selectedDuration}m` : ''}
                  {selectedBlock ? ` · ${selectedBlock.startTime}` : ''}
                  {selectedControllers ? ` · ${selectedControllers} Pad` : ''}
                  {calculatedTotalPrice > 0 ? ` · ₹${calculatedTotalPrice} INR` : ''}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={handlePrevStep}
                    className="px-5 py-2.5 rounded-full bg-[#161616] text-[var(--g400)] hover:text-white border border-[var(--g200)] transition-all cursor-none font-mono text-xs uppercase"
                  >
                    ← Back
                  </button>
                )}

                {currentStep < 5 ? (
                  <button
                    type="button"
                    onClick={handleNextStep}
                    className="px-7 py-2.5 rounded-full bg-[var(--red)] text-white font-mono text-xs font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(255,0,0,0.5)] hover:shadow-[0_0_30px_rgba(255,0,0,0.8)] active:scale-95 transition-all cursor-none flex items-center gap-2"
                  >
                    <span>Next Step</span>
                    <span>→</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={isSubmitting}
                    className="px-8 py-3 rounded-full bg-[var(--red)] text-white font-mono text-xs font-bold uppercase tracking-wider shadow-[0_0_25px_rgba(255,0,0,0.6)] hover:shadow-[0_0_35px_rgba(255,0,0,0.9)] active:scale-95 transition-all cursor-none flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        <span>LOCKING SLOT...</span>
                      </>
                    ) : (
                      <>
                        <span>BOOK SLOT</span>
                        <span>→</span>
                      </>
                    )}
                  </button>
                )}
              </div>

            </div>

          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* SUCCESS POPUP (CONFIRMED 6-CHAR BOOKING PASS) */}
      {/* ========================================================================= */}
      {successModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-[#0d0d12] p-6 sm:p-8 shadow-2xl text-white font-mono overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-teal-500/10 blur-[100px] pointer-events-none" />

            {/* Header Badge */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 uppercase tracking-widest">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span>SLOT RESERVED & LOCKED</span>
              </div>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                 VERIFIED
              </span>
            </div>

            {/* Pass Code Highlight Box */}
            <div className="my-6 p-5 rounded-2xl bg-black/80 border border-emerald-500/40 text-center space-y-2 relative shadow-[0_0_25px_rgba(16,185,129,0.15)]">
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">
                YOUR 6-CHARACTER BOOKING CODE
              </p>
              <div className="text-4xl sm:text-5xl font-black text-white tracking-widest font-mono select-all">
                {successModal.bookingId}
              </div>
              <button
                type="button"
                onClick={() => handleCopyCode(successModal.bookingId)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-gray-200 transition active:scale-95 cursor-none"
              >
                <span>{copiedCode ? '✓ Copied to clipboard' : '📋 Copy Code'}</span>
              </button>
            </div>

            {/* Reservation Summary */}
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-xs space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Date & Session</span>
                <span className="font-bold text-white text-right">
                  {successModal.formattedDate} • {successModal.timeRange}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Gamer Name</span>
                <span className="font-bold text-white">{successModal.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Hardware & Controllers</span>
                <span className="font-bold text-white">
                  Pod 01 • {successModal.controllers} {successModal.controllers > 1 ? 'Controllers' : 'Controller'} ({successModal.duration})
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-white/10 pt-2.5 text-sm">
                <span className="text-gray-400">Amount Paid / Reserved</span>
                <span className="font-black text-emerald-400">₹{successModal.totalPrice} INR</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              {/* <button
                type="button"
                onClick={() => router.push(`/book/success/${successModal.bookingId}`)}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 hover:brightness-110 active:scale-95 transition cursor-none flex items-center justify-center gap-2"
              >
                <span>VIEW ARENA PASS</span>
                <span>🎫</span>
              </button> */}

              <button
                type="button"
                onClick={() => {
                  setSuccessModal(null);
                  setCustomerName('');
                  setCustomerPhone('');
                  setCustomerEmail('');
                }}
                className="py-3 px-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-300 transition cursor-none"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ERROR POPUP (SLOT ALREADY TAKEN / CONCURRENCY COLLISION) */}
      {/* ========================================================================= */}
      {errorModal?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-md rounded-3xl border border-red-500/40 bg-[#0d0d12] p-6 sm:p-8 shadow-2xl text-white font-mono overflow-hidden">
            {/* Ambient Red Glow */}
            <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-red-500/15 blur-[100px] pointer-events-none" />

            {/* Alert Header Icon */}
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400 text-xl border border-red-500/30 shrink-0">
                {errorModal.isSlotFilled ? '⚠️' : '✕'}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  {errorModal.isSlotFilled ? 'SLOT ALREADY TAKEN' : 'RESERVATION FAILED'}
                </h3>
                <span className="text-[10px] text-red-400 uppercase font-bold">
                  {errorModal.isSlotFilled ? 'CONCURRENCY CONFLICT' : 'SYSTEM NOTICE'}
                </span>
              </div>
            </div>

            {/* Message Body */}
            <div className="my-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-gray-300 leading-relaxed">
              {errorModal.message}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              {errorModal.isSlotFilled ? (
                <>
                  <button
                    type="button"
                    onClick={handleCloseErrorAndPickSlot}
                    className="flex-1 py-3 px-4 rounded-xl bg-[var(--red)] text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-red-500/30 hover:brightness-110 active:scale-95 transition cursor-none flex items-center justify-center gap-2"
                  >
                    <span>CHOOSE ANOTHER TIME</span>
                    <span>→</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setErrorModal(null)}
                    className="py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold text-gray-400 transition cursor-none"
                  >
                    Dismiss
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setErrorModal(null)}
                  className="w-full py-3 px-4 rounded-xl border border-white/10 bg-white/10 hover:bg-white/20 text-xs font-bold text-white uppercase tracking-wider transition cursor-none"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}




