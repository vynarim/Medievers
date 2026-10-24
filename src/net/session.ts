// Meeting before the match (TECH_SPEC §8.3): the peers say hello and check they run the same
// game, then the creator sends the match; a peer back without its state gets it resumed.
import { Lockstep } from './lockstep.ts';
import { PROTOCOL_VERSION, type MatchStart, type NetMessage, type Role } from './protocol.ts';
import type { Transport } from './transport.ts';

export interface Joined {
  readonly lockstep: Lockstep;
  /** true when the match was already under way (a page reloaded): replay it to catch up */
  readonly resumed: boolean;
}

export type JoinError = 'version';

/**
 * Connects over `transport`. A new match's creator passes `start`: it waits for the other peer
 * and sends the match. Otherwise (the one who joins, or a creator whose page reloaded) the peer
 * asks for the match and gets it new or resumed. Messages after that go to the lockstep.
 */
export function connect(
  transport: Transport,
  role: Role,
  buildHash: string,
  start: MatchStart | null,
): Promise<Joined> {
  return new Promise((resolve, reject) => {
    let lockstep: Lockstep | null = null;
    let failed = false;
    const hello: NetMessage = { m: 'hello', protocolVersion: PROTOCOL_VERSION, buildHash, tick: 0 };
    const done = (ls: Lockstep, resumed: boolean): void => {
      lockstep = ls;
      resolve({ lockstep: ls, resumed });
    };
    transport.onMessage((msg) => {
      if (failed) return;
      if (
        msg.m === 'hello' &&
        (msg.protocolVersion !== PROTOCOL_VERSION || msg.buildHash !== buildHash)
      ) {
        failed = true;
        // The creator has not spoken yet: it answers, so the other side learns it too.
        if (start) transport.send(hello);
        reject(new Error('version' satisfies JoinError));
        return;
      }
      if (lockstep) {
        lockstep.receive(msg);
        return;
      }
      if (start) {
        // The creator: the other peer said hello, here is the match.
        if (msg.m === 'hello') {
          transport.send(hello);
          transport.send({ m: 'start', start });
          done(new Lockstep(role, start, transport), false);
        }
        return;
      }
      if (msg.m === 'start') done(new Lockstep(role, msg.start, transport), false);
      else if (msg.m === 'resume')
        done(
          new Lockstep(role, msg.start, transport, msg.frames),
          msg.frames.length > msg.start.delay,
        );
    });
    if (!start) transport.send(hello);
  });
}
