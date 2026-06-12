import { useState, useEffect, useRef, useCallback } from 'react'
import './App.css'

const FLAGS = ['청기', '백기']
const ACTIONS = ['올려', '내려']
const START_TIME = 2000
const MIN_TIME = 700
const SPEEDUP = 60

// 다음 명령을 생성한다. 함정(~지 마) 확률 30%.
function makeCommand() {
  const flag = FLAGS[Math.floor(Math.random() * FLAGS.length)]
  const action = ACTIONS[Math.floor(Math.random() * ACTIONS.length)]
  const negate = Math.random() < 0.3
  return { flag, action, negate }
}

// 명령에 대한 정답 버튼 키. 함정이면 '그대로'.
function answerOf(cmd) {
  if (cmd.negate) return 'pass'
  return `${cmd.flag}-${cmd.action}`
}

function commandText(cmd) {
  if (cmd.negate) return `${cmd.flag} ${cmd.action}지 마`
  return `${cmd.flag} ${cmd.action}`
}

function Flag({ color, up }) {
  return (
    <div className={`flag-wrap ${up ? 'up' : 'down'}`}>
      <div className="pole">
        <div className={`flag ${color}`}>
          <span>{color === 'blue' ? '청기' : '백기'}</span>
        </div>
      </div>
      <div className="hand">✊</div>
    </div>
  )
}

export default function App() {
  const [phase, setPhase] = useState('idle') // idle | playing | over
  const [command, setCommand] = useState(null)
  const [blueUp, setBlueUp] = useState(false)
  const [whiteUp, setWhiteUp] = useState(false)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => {
    const v = Number(localStorage.getItem('cheonggi-best'))
    return Number.isFinite(v) ? v : 0
  })
  const [lives, setLives] = useState(3)
  const [timeLimit, setTimeLimit] = useState(START_TIME)
  const [tick, setTick] = useState(0) // 타이머 바 리셋용
  const [feedback, setFeedback] = useState(null) // 'good' | 'bad'

  const timerRef = useRef(null)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const endGame = useCallback((finalScore) => {
    clearTimer()
    setPhase('over')
    setBest((prev) => {
      const next = Math.max(prev, finalScore)
      localStorage.setItem('cheonggi-best', String(next))
      return next
    })
  }, [])

  const nextRound = useCallback(
    (limit) => {
      const cmd = makeCommand()
      setCommand(cmd)
      setTick((t) => t + 1)
      clearTimer()
      timerRef.current = setTimeout(() => {
        // 시간 초과 = 실패
        setFeedback('bad')
        setLives((l) => {
          const left = l - 1
          if (left <= 0) {
            setScore((s) => {
              endGame(s)
              return s
            })
          } else {
            nextRound(limit)
          }
          return left
        })
      }, limit)
    },
    [endGame],
  )

  const startGame = () => {
    setScore(0)
    setLives(3)
    setBlueUp(false)
    setWhiteUp(false)
    setTimeLimit(START_TIME)
    setFeedback(null)
    setPhase('playing')
    nextRound(START_TIME)
  }

  const handleAnswer = (key) => {
    if (phase !== 'playing' || !command) return
    clearTimer()
    const correct = key === answerOf(command)

    // 깃발 상태 반영 (함정이 아닌 정답 동작일 때만)
    if (correct && !command.negate) {
      const up = command.action === '올려'
      if (command.flag === '청기') setBlueUp(up)
      else setWhiteUp(up)
    }

    if (correct) {
      setFeedback('good')
      setScore((s) => s + 1)
      const newLimit = Math.max(MIN_TIME, timeLimit - SPEEDUP)
      setTimeLimit(newLimit)
      nextRound(newLimit)
    } else {
      setFeedback('bad')
      setLives((l) => {
        const left = l - 1
        if (left <= 0) {
          setScore((s) => {
            endGame(s)
            return s
          })
        } else {
          nextRound(timeLimit)
        }
        return left
      })
    }
  }

  // feedback 깜빡임 자동 해제
  useEffect(() => {
    if (!feedback) return
    const id = setTimeout(() => setFeedback(null), 250)
    return () => clearTimeout(id)
  }, [feedback, tick])

  // 언마운트 시 타이머 정리
  useEffect(() => clearTimer, [])

  const buttons = [
    { key: '청기-올려', label: '청기 올려', cls: 'blue' },
    { key: '청기-내려', label: '청기 내려', cls: 'blue ghost' },
    { key: '백기-올려', label: '백기 올려', cls: 'white' },
    { key: '백기-내려', label: '백기 내려', cls: 'white ghost' },
    { key: 'pass', label: '그대로 (함정)', cls: 'pass' },
  ]

  return (
    <main className={`game ${feedback ? `flash-${feedback}` : ''}`}>
      <header className="topbar">
        <h1>🚩 청기백기 게임</h1>
        <p className="sub">명령을 잘 듣고 빠르게 반응하세요!</p>
      </header>

      <section className="stage">
        <Flag color="blue" up={blueUp} />
        <Flag color="white" up={whiteUp} />
      </section>

      {phase === 'playing' && (
        <>
          <div className="hud">
            <span className="score">점수 {score}</span>
            <span className="lives">
              {'❤️'.repeat(lives)}
              {'🤍'.repeat(3 - lives)}
            </span>
          </div>

          <div className={`command ${command?.negate ? 'trap' : ''}`}>
            {command && commandText(command)}
          </div>

          <div className="timer">
            <div
              key={tick}
              className="timer-fill"
              style={{ animationDuration: `${timeLimit}ms` }}
            />
          </div>

          <div className="pad">
            {buttons.map((b) => (
              <button
                key={b.key}
                className={`btn ${b.cls}`}
                onClick={() => handleAnswer(b.key)}
              >
                {b.label}
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'idle' && (
        <div className="overlay">
          <p className="rule">
            화면의 명령에 맞는 버튼을 누르세요.<br />
            <b>“~지 마”</b> 가 붙으면 함정! <b>그대로</b> 버튼을 눌러야 합니다.<br />
            정답마다 속도가 빨라지고, 기회는 3번입니다.
          </p>
          <button className="start" onClick={startGame}>
            게임 시작
          </button>
          <p className="best">최고 점수: {best}</p>
        </div>
      )}

      {phase === 'over' && (
        <div className="overlay">
          <h2 className="result">게임 종료!</h2>
          <p className="final">최종 점수 {score}</p>
          <p className="best">최고 점수: {best}</p>
          <button className="start" onClick={startGame}>
            다시 하기
          </button>
        </div>
      )}

      <footer className="foot">React + Vite · GitHub Pages 배포</footer>
    </main>
  )
}
