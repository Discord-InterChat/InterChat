import ServerInfractionManager from './ServerInfractionManager.js';
import UserInfractionManager from './UserInfractionManager.js';

export class InfractionManagerFactory {
  static create(type: 'user' | 'server', targetId: string) {
    return type === 'server'
      ? new ServerInfractionManager(targetId)
      : new UserInfractionManager(targetId);
  }
}
