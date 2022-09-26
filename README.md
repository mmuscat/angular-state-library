# Angular State Library

Manage state in your Angular applications. **Status: in development** 

[Read the Intro](https://dev.to/antischematic/angular-state-library-3gkl)

[Try it on StackBlitz](https://stackblitz.com/edit/angular-state-library?file=src%2Fapp%2Fui-todos.component.ts)

## API

Version: 0.2.0

This API is experimental.

<!-- TOC -->
* [Angular State Library](#angular-state-library)
  * [API](#api)
    * [Core](#core)
      * [Store](#store)
      * [Action](#action)
      * [Invoke](#invoke)
      * [Before](#before)
      * [Layout](#layout)
      * [Select](#select)
      * [Caught](#caught)
    * [Effects](#effects)
      * [createDispatch](#createdispatch)
      * [loadEffect](#loadeffect)
    * [Hooks](#hooks)
      * [useOperator](#useoperator)
      * [useConcat](#useconcat)
      * [useExhaust](#useexhaust)
      * [useMerge](#usemerge)
      * [useSwitch](#useswitch)
    * [Reactivity](#reactivity)
      * [TemplateProvider](#templateprovider)
      * [select](#select)
      * [track (alias: `$`)](#track--alias---)
      * [untrack (alias: `$$`)](#untrack--alias---)
      * [isProxy](#isproxy)
  * [Testing Environment](#testing-environment)
<!-- TOC -->

### Core

#### Store

> Note: 
> `@Store` only works on classes decorated with `@Component` or `@Directive`

Marks the decorated directive as a store. This decorator is required for all other decorators to function.

**Basic usage**

```ts
@Store()
@Component()
export class UICounter {}
```

#### Action

Marks the decorated method as an action. Each action runs in its own `EnvironmentInjector` context. When the action is called it automatically schedules a `Dispatch` event for the next change detection cycle.

**Example: Basic action**

```ts
@Store()
@Component()
export class UICounter {
   @Input() count = 0
   
   @Action() increment() {
      this.count++
   }
}
```

**Example: Action with dependency injection**

```ts
@Store()
@Component()
export class UITodos {
   todos = []
   
   @Action() loadTodos() {
      const endpoint = "https://jsonplaceholder.typicode.com/todos"
      const loadTodos = inject(HttpClient).get(endpoint)
      
      dispatch(loadTodos, (todos) => {
         this.todos = todos
      })
   }
}

const dispatch = createDispatch(UITodos)
```

#### Invoke

See `Action`. The method receives a reactive `this` context that tracks dependencies. The action is called automatically during `ngDoCheck` on the first change detection cycle and again each time its reactive dependencies change.

**Example: Reactive actions**

This example logs the value of `count` whenever it changes via `@Input` or `increment`.

```ts
@Store()
@Component()
export class UICounter {
   @Input() count = 0

   @Action() increment() {
      this.count++
   }

   @Invoke() logCount() {
      console.log(this.count)
   }
}
```

#### Before

See `Invoke`. Dependencies are checked during `ngAfterContentChecked`. Use this when an action depends on `ContentChild` or `ContentChildren`.

**Example: Reactive content query**

This example creates an embedded view using `ContentChild`.

```ts
@Store()
@Component()
export class UIDynamic {
   @ContentChild(TemplateRef)
   template?: TemplateRef

   @Before() createView() {
      const viewContainer = inject(ViewContainerRef)
      if (this.template) {
         viewContainer.createEmbeddedView(this.template)
      }
   }
}
```

#### Layout

See `Invoke`. Dependencies are checked during `ngAfterViewChecked`. Use this when an action depends on `ViewChild` or `ViewChildren`.


**Example: Reactive view query**

This example logs when the number of child components change.

```ts
@Store()
@Component()
export class UIParent {
   @ViewChildren(UIChild)
   viewChildren?: QueryList<UIChild>

   @Layout() countElements() {
      const { length } = $(this.viewChildren)
      console.log(`There are ${length} elements on the page`)
   }
}
```

#### Select

Marks the decorated accessor or method as a selector. Use selectors to derive state from other class properties. Can be chained with other selectors. Selectors receive a reactive `this` context that tracks dependencies. Selectors are memoized until its dependencies change. Selectors are not evaluated until its value is read. The memoization cache is purged each time reactive dependencies change.

For method selectors, arguments must be serializable with `JSON.stringify`.

**Example: Computed properties**

```ts
@Store()
@Component()
export class UICounter {
   @Input() count = 0
   
   @Select() get double() {
      return this.count * 2
   }
}
```

**Example: Computed methods**

```ts
@Store()
@Component()
export class UITodos {
   todos = []
   
   @Select() getTodosByUserId(userId: string) {
      return this.todos.filter(todo => todo.userId === userId)
   }
}
```

#### Caught

Marks the decorated method as an error handler. Unhandled exceptions inside `Action`, `Invoke`, `Before`, `Layout` and `Select` are forwarded to the first error handler. Unhandled exceptions from dispatched effects are also captured. If the class has multiple error handlers, rethrown errors will propagate to the next error handler in the chain from top to bottom. If the last error handler rethrows an error it is propagated to the `ErrorHandler` service.

**Example: Handling exceptions**

```ts
@Store()
@Component()
export class UITodos {
   @Action() loadTodos() {
      throw new Error("Whoops!")
   }
   
   @Caught() handleError(error: unknown) {
      console.debug("Error caught", error)
   }
}
```

### Effects

In Angular State Library effects are just plain RxJS observables.

#### createDispatch

Creates a function for dispatching effects from an action. Dispatchers can only be called inside the stack frame of a method decorated with `@Action`, `@Invoke`, `@Before` or `@Layout`. The dispatcher has the following type signature:

```ts
export interface Dispatch<T> {
   <U>(source: Observable<U>): Observable<U>
   <U>(source: Observable<U>, observer: DispatchObserver<T, U>): Observable<U>
   <U>(source: Observable<U>, next: (this: T, value: U) => void): Observable<U>
}
```

The `DispatchObserver` is bound to the directive instance by default.

**Example: Dispatching effects**

```ts
@Store()
@Component()
export class UITodos {
   @Input() userId: string
   
   todos: Todo[] = []

   @Invoke() loadTodos() {
      const endpoint = "https://jsonplaceholder.typicode.com/todos"
      const loadTodos = inject(HttpClient).get(endpoint, {
         params: { userId: this.userId }
      })

      dispatch(loadTodos, (todos) => {
         this.todos = todos
      })
   }
}

const dispatch = createDispatch(UITodos)
```

#### loadEffect

Use with `createDispatch` to lazy load effects.

**Example: Lazy load effects**

```ts
// load-todos.ts
export default function loadTodos(userId: string) {
   const endpoint = "https://jsonplaceholder.typicode.com/todos"
   return inject(HttpClient).get(endpoint, {
      params: { userId }
   })
}
```
```ts
@Store()
@Component()
export class UITodos {
   @Input() userId: string
   
   todos: Todo[] = []

   @Invoke() loadTodos() {
      dispatch(loadTodos(this.userId), (todos) => {
         this.todos = todos
      })
   }
}

const dispatch = createDispatch(UITodos)
const loadTodos = loadEffect(() => import("./load-todos"))
```

### Hooks

Actions can be configured with their own providers. Action providers can be injected using `inject`. Hooks are simply wrappers around `inject` for configuring action providers. Actions have access to the `EffectScheduler` used by `createDispatch` to schedule dispatched effects.

> Note:
> Custom action providers and hooks is planned for a future release.

#### useOperator

Sets the flattening operator for merging effects. The default strategy is `switchAll`. When calling `useOperator` multiple times only the last call before calling `dispatch` is used. Once `dispatch` is called the operator is locked and cannot be changed.

**Example: Debounce effects**

```ts
function useSwitchDebounce(milliseconds: number) {
   return useOperator(source => {
      return source.pipe(
         debounceTime(milliseconds),
         switchAll()
      )
   })
}
```

```ts
@Store()
@Component()
export class UITodos {
   @Input() userId: string
   
   todos: Todo[] = []

   @Invoke() loadTodos() {
      useSwitchDebounce(1000)
      
      dispatch(loadTodos(this.userId), (todos) => {
         this.todos = todos
      })
   }
}
```

**Example: Compose hooks with effects**

```ts
export default function loadTodos(userId: string) {
   useSwitchDebounce(1000)
   return inject(HttpClient).get(endpoint, {
      params: { userId }
   })
}
```

#### useConcat

Synonym for `useOperator(concatAll())`

#### useExhaust

Synonym for `useOperator(exhaustAll())`

#### useMerge

Synonym for `useOperator(mergeAll())`

#### useSwitch

Synonym for `useOperator(switchAll())`. This is the default behaviour.

### Reactivity

#### TemplateProvider

Provide values from a component template reactively. Template providers are styled with `display: contents` so they don't break grid layouts. Only use template providers with an element selector on a `@Directive`. Use with `select` to keep dependant views in sync.

**Example: Theme Provider**

```ts
@Directive({
   standalone: true,
   selector: "ui-theme"
})
export class UITheme extends TemplateProvider {
   color = "red"
}
```

```html
<ui-theme>
   <ui-theme-button>Red button</ui-theme-button>
   <ui-theme [value]="{ color: 'green' }">
      <ui-theme-button>Green button</ui-theme-button>
   </ui-theme>
</ui-theme>
```

```ts
@Component()
export class UIThemeButton {
   theme = select(UITheme)
   
   @HostBinding("style.color") get color() {
      return this.theme.color
   }
}
```

#### select

Inject a store and run change detection whenever the store emits an event. Use this instead of `inject` to keep views in sync with store state.

#### track (alias: `$`)

Track arbitrary objects inside reactive actions and selectors.

#### untrack (alias: `$$`)

Unwraps a proxy object, returning the original object.

#### isProxy

Returns `true` if the value is a proxy object created with `track`

## Testing Environment

For Angular State Library to function correctly in unit tests, some additional setup is required. For a default Angular CLI setup, import the ` initStoreTestEnvironment` from `@antischematic/angular-state-library/testing` and call it just after the test environment is initialized. Sample code is provided below.

```ts
// test.ts (or your test setup file)

import { initStoreTestEnvironment } from "@antischematic/angular-state-library/testing"; // <--------- ADD THIS LINE

// First, initialize the Angular testing environment.
getTestBed().initTestEnvironment(
   BrowserDynamicTestingModule,
   platformBrowserDynamicTesting(),
);
// Now setup store hooks
initStoreTestEnvironment() // <--------- ADD THIS LINE

// Then we find all the tests.
const context = require.context('./', true, /\.spec\.ts$/);
// And load the modules.
context.keys().forEach(context);
```
