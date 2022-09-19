import {untrack} from "./proxy";
import {ActionType} from "./interfaces";
import {EventScheduler} from "./core";
import {getToken} from "./metadata";

export function isPlainObject(obj: object) {
   const proto = Object.getPrototypeOf(obj)
   return proto === null || proto === Object.prototype
}

export function call(target: Record<any, any>, key: string, ...args: any[]) {
   return target[key].apply(target, args)
}

export function wrap(target: { [key: PropertyKey]: any }, property: PropertyKey, fn: (this: any, ...args: any[]) => any) {
   const descriptor = Object.getOwnPropertyDescriptor(target, property)!
   const object = descriptor ? descriptor : target
   const getOrValue = descriptor?.get ? "get" : "value"
   const originalFunction = (descriptor ? descriptor[getOrValue] : object[property]) ?? noop

   Object.defineProperty(target, property, {
      configurable: true,
      [getOrValue]: function (this: unknown, ...args: any[]) {
         return fn.call(untrack(this), originalFunction, ...args)
      }
   })
}

function noop() {}

let id = 0

export function getId() {
   return id++
}

export function dispatch(type: ActionType, context: {}, name: string, value: unknown) {
   const events = getToken(EventScheduler, context)
   events.push({
      id: getId(),
      timestamp: Date.now(),
      type,
      context,
      name,
      value,
   })
}
