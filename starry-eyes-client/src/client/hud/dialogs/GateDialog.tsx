import { useGameStore } from '../store.ts';
import './GateDialog.css';

export function GateDialog() {
  const gateDialog = useGameStore((s) => s.gateDialog);
  const bridge = useGameStore((s) => s.bridge);
  const dismissGateDialog = useGameStore((s) => s.dismissGateDialog);

  if (!gateDialog || !bridge) return null;

  async function handleJump(targetSystemIndex: number) {
    if (bridge!.jumpGate) {
      await bridge!.jumpGate(targetSystemIndex);
    }
    dismissGateDialog();
  }

  return (
    <div className="gate-dialog-backdrop" onClick={dismissGateDialog}>
      <div className="gate-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="gate-dialog-header">
          <span className="gate-dialog-label">JUMP GATE</span>
          <span className="gate-dialog-title">DESTINATIONS</span>
        </div>

        <div className="gate-dialog-connections">
          {gateDialog.connections.map((conn) => (
            <div key={conn.systemIndex} className="gate-dialog-connection">
              <span className="gate-dialog-system-name">{conn.systemName}</span>
              <button
                className="gate-dialog-btn-jump"
                onClick={() => handleJump(conn.systemIndex)}
              >
                JUMP
              </button>
            </div>
          ))}
          {gateDialog.connections.length === 0 && (
            <div className="gate-dialog-label" style={{ textAlign: 'center', padding: '8px 0' }}>
              NO CONNECTIONS
            </div>
          )}
        </div>

        <div className="gate-dialog-close">
          <button className="gate-dialog-btn-close" onClick={dismissGateDialog}>
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
