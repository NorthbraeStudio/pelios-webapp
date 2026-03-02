// src/global.d.ts
import 'react';

declare module 'react' {
  interface StyleHTMLAttributes<T> extends React.HTMLAttributes<T> {
    jsx?: boolean;
    global?: boolean;
  }
}

declare module 'react-player' {
  import { Component } from 'react';
  export default class ReactPlayer extends Component<any> {
    seekTo(amount: number, type?: 'seconds' | 'fraction'): void;
  }
}
