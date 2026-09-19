import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCookingStore } from '../stores/useCookingStore';
import { Slide } from '../design-system/motion';
import { api } from '../services/api';
import { Button } from '../components/common/Button';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { InlineError, InlineLoading } from '../components/common/AsyncState';
import { queryKeys } from '../lib/queryKeys';
import { capturePrivateSession } from '../lib/private-session';
import { invalidateWeekDependents } from '../lib/query-invalidation';
import { FRIGO_ASSETS } from '../lib/frigo-assets';
import { ArrowLeft, Play, Pause, RotateCcw, Clock, Volume2, VolumeX, Mic, MicOff, CheckCircle2, Refrigerator, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import { audioEffects } from '../lib/audio-effects';
import { voiceChef } from '../lib/voice-chef';

export const CookingModePage: React.FC = () => {
  const navigate = useNavigate();
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const recipeKey = slug || id || '';

  const {
    activeRecipe,
    currentStepIndex,
    timerSecondsRemaining,
    isTimerRunning,
    deductions,
    nextStep,
    prevStep,
    setTimer,
    tickTimer,
    toggleTimer,
    updateDeduction,
    resetCooking,
    startCooking,
  } = useCookingStore();

  const [isCompletedView, setIsCompletedView] = useState(false);
  const [isDeducting, setIsDeducting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [heardText, setHeardText] = useState<string | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  // Step direction for the cooking-step transition (motion/page-transitions.md).
  const [stepDirection, setStepDirection] = useState<1 | -1>(1);

  const recipeMatches = activeRecipe?.slug === recipeKey || activeRecipe?.id === recipeKey;
  const recipeQuery = useQuery({
    queryKey: queryKeys.recipe(recipeKey),
    queryFn: () => api.getRecipeById(recipeKey),
    enabled: Boolean(recipeKey) && !recipeMatches,
  });
  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
    enabled: Boolean(recipeKey) && !recipeMatches,
  });

  useEffect(() => {
    if (!recipeMatches && recipeQuery.data?.recipe && inventoryQuery.data) {
      startCooking(recipeQuery.data.recipe, inventoryQuery.data);
    }
  }, [recipeMatches, recipeQuery.data, inventoryQuery.data, startCooking]);

  // Timer interval & sound alert
  useEffect(() => {
    let interval: any = null;
    if (isTimerRunning && timerSecondsRemaining !== null && timerSecondsRemaining > 0) {
      interval = setInterval(() => {
        tickTimer();
      }, 1000);
    } else if (timerSecondsRemaining === 0) {
      audioEffects.playTimerAlertSound();
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([200, 100, 200, 100, 400]);
      }
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timerSecondsRemaining, tickTimer]);

  // Clean up voice on unmount
  useEffect(() => {
    return () => {
      voiceChef.stopSpeaking();
      voiceChef.stopListening();
    };
  }, []);

  const toggleSpeak = () => {
    if (!activeRecipe) return;
    const currentStep = activeRecipe.steps[currentStepIndex];
    if (isSpeaking) {
      voiceChef.stopSpeaking();
      setIsSpeaking(false);
    } else {
      const ok = voiceChef.speakInstruction(currentStep.instruction, () => {
        setIsSpeaking(false);
      });
      if (ok) setIsSpeaking(true);
    }
  };

  const toggleListening = () => {
    if (!activeRecipe) return;
    if (isListening) {
      voiceChef.stopListening();
      setIsListening(false);
      setHeardText(null);
    } else {
      setIsListening(true);
      voiceChef.startListening({
        onNext: () => {
          audioEffects.playStepClickSound();
          if (currentStepIndex < activeRecipe.steps.length - 1) {
            nextStep();
          }
        },
        onPrev: () => {
          audioEffects.playStepClickSound();
          if (currentStepIndex > 0) {
            prevStep();
          }
        },
        onRepeat: () => {
          const step = activeRecipe.steps[currentStepIndex];
          voiceChef.speakInstruction(step.instruction);
        },
        onStartTimer: () => {
          const step = activeRecipe.steps[currentStepIndex];
          if (step.timerMinutes) {
            setTimer(step.timerMinutes * 60);
          }
        },
        onPauseTimer: () => {
          toggleTimer();
        },
        onHeardCommand: (text) => {
          setHeardText(text);
          setTimeout(() => setHeardText(null), 3000);
        },
        onError: () => {
          setIsListening(false);
        },
      });
    }
  };

  const handleNext = () => {
    audioEffects.playStepClickSound();
    setStepDirection(1);
    nextStep();
  };

  const handlePrev = () => {
    audioEffects.playStepClickSound();
    setStepDirection(-1);
    prevStep();
  };

  const handleComplete = () => {
    audioEffects.playSuccessChime();
    setIsCompletedView(true);
  };

  if (!activeRecipe || !recipeMatches) {
    const loadingError = recipeQuery.error || inventoryQuery.error;
    return (
      <div className="min-h-screen bg-takosan-cream p-6 flex flex-col justify-center items-center text-center gap-4">
        {loadingError ? (
          <InlineError error={loadingError} onRetry={() => {
            void recipeQuery.refetch();
            void inventoryQuery.refetch();
          }} />
        ) : !recipeKey || (recipeQuery.isSuccess && !recipeQuery.data?.recipe) ? (
          <p role="alert">Không tìm thấy công thức này.</p>
        ) : (
          <InlineLoading label="Đang tải bước nấu…" />
        )}
        <Button variant="outline" onClick={() => navigate('/recipes')}>Xem công thức</Button>
      </div>
    );
  }

  const currentStep = activeRecipe.steps[currentStepIndex];
  const isLastStep = currentStepIndex === activeRecipe.steps.length - 1;
  const progressPercent = Math.round(((currentStepIndex + 1) / activeRecipe.steps.length) * 100);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleConfirmDeductions = async () => {
    const isCurrent = capturePrivateSession();
    setIsDeducting(true);
    setCompletionError(null);
    try {
      await api.completeCooking(activeRecipe.id, deductions);
      if (!isCurrent()) return;
      void invalidateWeekDependents();
      resetCooking();
      navigate('/fridge');
    } catch {
      if (!isCurrent()) return;
      setCompletionError('Chưa cập nhật được tủ lạnh. Vui lòng thử lại.');
      setIsDeducting(false);
    }
  };

  // 1. Completion view (Deduction confirmation)
  if (isCompletedView) {
    return (
      <div className="min-h-screen bg-takosan-cream p-4 flex flex-col justify-between pb-10 max-w-md mx-auto">
        <div className="space-y-4">
          {completionError && <p role="alert" className="text-sm text-rose-700">{completionError}</p>}
          <div className="text-center pt-4">
            <div className="w-28 h-28 mx-auto mb-2 overflow-hidden flex items-center justify-center">
              <img
                src={FRIGO_ASSETS.illustrations['delicious-meal']}
                alt="Delicious meal"
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="font-heading font-bold text-2xl text-slate-900">
              Món ăn hoàn tất! 🎉
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
              Bạn đã nấu xong <span className="font-semibold text-slate-900">{activeRecipe.title}</span>.
            </p>
          </div>

          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm text-slate-900 flex items-center gap-1.5">
                <Refrigerator className="w-4 h-4 text-takosan-green" />
                <span>Cập nhật số lượng trong tủ lạnh</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">Tự động trừ đồ</span>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Dưới đây là lượng nguyên liệu đã dùng. Bạn có thể chỉnh sửa trước khi xác nhận cập nhật tủ lạnh.
            </p>

            <div className="space-y-2">
              {deductions.map((d) => (
                <div
                  key={d.ingredientId}
                  className="bg-white rounded-xl p-3.5 flex items-center justify-between border border-slate-200/80 shadow-xs"
                >
                  <div>
                    <h4 className="font-heading font-semibold text-sm text-slate-900">
                      {d.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ban đầu: {d.currentQuantity} {d.unit} &rarr; Còn: {d.remainingQuantity} {d.unit}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-600">
                      -{d.quantityDeducted} {d.unit}
                    </span>

                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-lg p-0.5 shadow-xs">
                      <button
                        onClick={() => updateDeduction(d.ingredientId, Math.max(0, d.quantityDeducted - (d.unit === 'g' ? 50 : 1)))}
                        className="w-7 h-7 flex items-center justify-center font-bold text-slate-700 hover:bg-white rounded-md tap-target transition-colors"
                        aria-label="Giảm"
                      >
                        –
                      </button>
                      <button
                        onClick={() => updateDeduction(d.ingredientId, Math.min(d.currentQuantity, d.quantityDeducted + (d.unit === 'g' ? 50 : 1)))}
                        className="w-7 h-7 flex items-center justify-center font-bold text-slate-700 hover:bg-white rounded-md tap-target transition-colors"
                        aria-label="Tăng"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pt-4">
          <Button
            fullWidth
            size="lg"
            onClick={handleConfirmDeductions}
            isLoading={isDeducting}
            className="flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Xác nhận & Cập nhật tủ lạnh</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    );
  }

  // 2. Active step cooking mode
  return (
    <div className="min-h-screen bg-takosan-cream flex flex-col justify-between p-5 max-w-md mx-auto">
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setConfirmExit(true)}
            className="w-10 h-10 rounded-xl hover:bg-slate-100 active:scale-95 text-slate-700 flex items-center justify-center tap-target transition-colors"
            aria-label="Thoát chế độ nấu"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="text-center">
            <h2 className="font-heading font-bold text-base text-slate-900 truncate max-w-[180px]">
              {activeRecipe.title}
            </h2>
            <p className="text-xs text-slate-500 font-medium">
              Bước {currentStepIndex + 1} / {activeRecipe.steps.length}
            </p>
          </div>

          {/* Voice Sous Chef Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleListening}
              className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center tap-target transition-tap active:scale-95 border',
                isListening
                  ? 'bg-rose-500 border-rose-500 text-white shadow-xs animate-pulse'
                  : 'bg-takosan-mint border-takosan-mint-deep/60 text-takosan-green-deep hover:bg-takosan-mint-hover'
              )}
              title={isListening ? 'Đang nghe... Bấm để tắt' : 'Bật trợ lý rảnh tay'}
              aria-label={isListening ? 'Tắt trợ lý rảnh tay' : 'Bật trợ lý rảnh tay'}
            >
              {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4 text-takosan-green" />}
            </button>

            <button
              onClick={toggleSpeak}
              className={clsx(
                'w-10 h-10 rounded-xl flex items-center justify-center tap-target transition-tap active:scale-95 border',
                isSpeaking
                  ? 'bg-takosan-green border-takosan-green text-white shadow-xs'
                  : 'bg-takosan-mint border-takosan-mint-deep/60 text-takosan-green-deep hover:bg-takosan-mint-hover'
              )}
              title={isSpeaking ? 'Dừng đọc' : 'Đọc to bước này'}
              aria-label={isSpeaking ? 'Dừng đọc' : 'Đọc to bước này'}
            >
              {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-takosan-green" />}
            </button>
          </div>
        </div>

        {/* Listening Status Banner */}
        {isListening && (
          <div className="mb-2.5 px-3 py-1.5 rounded-xl bg-takosan-mint border border-takosan-mint-deep/60 flex items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-center gap-1.5 text-xs text-takosan-green-deep font-medium">
              <span className="w-2 h-2 rounded-full bg-takosan-green animate-ping" />
              <span>{heardText ? `Đã nghe: "${heardText}"` : 'Trợ lý đang nghe khẩu lệnh: "tiếp", "lùi", "đọc lại"...'}</span>
            </div>
            <span className="text-[10px] font-semibold text-takosan-green uppercase">Rảnh tay</span>
          </div>
        )}

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-200/80 rounded-full overflow-hidden">
          <div
            className="h-full bg-takosan-green transition-tap duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Instruction Card */}
      <div className="my-6 flex-1 flex flex-col justify-center">
        {/* Directional step transition: +24px forward, reverse on Back;
            timer logic never depends on animation frames. */}
        <Slide key={currentStepIndex} direction={stepDirection} distance={24}>
        <div className="bg-white rounded-2xl p-6 shadow-card border border-slate-200/80 text-center space-y-4">
          <span className="w-10 h-10 rounded-xl bg-takosan-mint border border-takosan-mint-deep/60 flex items-center justify-center font-heading font-bold text-base text-takosan-green-deep mx-auto shadow-xs">
            {currentStep.stepNumber}
          </span>

          <p className="font-heading font-bold text-xl sm:text-2xl text-slate-900 leading-relaxed text-left">
            {currentStep.instruction}
          </p>

          {currentStep.tip && (
            <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-900 text-left border border-amber-200/60 font-medium">
              💡 <span className="font-bold">Mẹo:</span> {currentStep.tip}
            </div>
          )}

          {/* Interactive Step Timer */}
          {currentStep.timerMinutes && (
            <div className="pt-2">
              {timerSecondsRemaining === null ? (
                <button
                  onClick={() => setTimer(currentStep.timerMinutes! * 60)}
                  className="px-4 py-2.5 rounded-xl bg-takosan-mint border border-takosan-mint-deep/60 text-takosan-green-deep font-heading font-semibold text-xs flex items-center justify-center gap-2 mx-auto hover:bg-takosan-mint-hover active:scale-95 transition-tap shadow-xs tap-target"
                >
                  <Clock className="w-4 h-4 text-takosan-green" />
                  <span>Bật hẹn giờ ({currentStep.timerMinutes} phút)</span>
                </button>
              ) : (
                <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 flex items-center justify-between max-w-xs mx-auto shadow-xs">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-takosan-green animate-pulse" />
                    <span className="font-heading font-bold text-2xl text-slate-900 font-mono">
                      {formatTimer(timerSecondsRemaining)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={toggleTimer}
                      className="p-2 rounded-lg bg-white border border-slate-200 shadow-xs hover:bg-slate-50 text-slate-700 tap-target flex items-center justify-center transition-colors"
                      aria-label={isTimerRunning ? 'Tạm dừng' : 'Bắt đầu'}
                    >
                      {isTimerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => setTimer(currentStep.timerMinutes! * 60)}
                      className="p-2 rounded-lg bg-white border border-slate-200 shadow-xs hover:bg-slate-50 text-slate-700 tap-target flex items-center justify-center transition-colors"
                      aria-label="Đặt lại giờ"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </Slide>
      </div>

      {/* Step Navigation Buttons */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={handlePrev}
          disabled={currentStepIndex === 0}
          className="flex-1"
        >
          Bước trước
        </Button>

        {isLastStep ? (
          <Button
            size="lg"
            onClick={handleComplete}
            className="flex-1 bg-takosan-green hover:bg-takosan-green-hover flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            <span>Hoàn thành nấu</span>
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={handleNext}
            className="flex-1"
          >
            Bước tiếp theo
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirmExit}
        title="Thoát chế độ nấu?"
        description="Tiến trình các bước nấu hiện tại sẽ không được lưu."
        confirmText="Thoát"
        destructive
        onConfirm={() => {
          setConfirmExit(false);
          resetCooking();
          navigate(-1);
        }}
        onCancel={() => setConfirmExit(false)}
      />
    </div>
  );
};
