import BaseEventListener from '#main/core/BaseEventListener.js';
import Logger from '#main/utils/Logger.js';

export default class Ready extends BaseEventListener<'debug'> {
  readonly name = 'debug';
  public execute(message: string) {
    Logger.debug(message);
  }
}
