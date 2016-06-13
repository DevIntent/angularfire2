import {Provider, Inject, provide, Injectable, Optional} from '@angular/core';
import { Observable } from 'rxjs/Observable';
import { Observer } from 'rxjs/Observer';
import {ReplaySubject} from 'rxjs/ReplaySubject';
import {FirebaseApp, FirebaseAuthConfig} from '../tokens';
import {isPresent} from '../utils/utils';
import * as utils from '../utils/utils';
import {
  authDataToAuthState,
  AuthBackend,
  AuthProviders,
  AuthMethods,
  AuthToken,
  EmailPasswordCredentials,
  OAuthCredential,
  AuthConfiguration,
  FirebaseAuthState,
} from './auth_backend';

const kBufferSize = 1;

export const firebaseAuthConfig = (config: AuthConfiguration): Provider => {
  return provide(FirebaseAuthConfig, {
    useValue: config
  });
};

@Injectable()
export class AngularFireAuth extends ReplaySubject<FirebaseAuthState> {
  constructor(private _authBackend: AuthBackend,
    @Optional() @Inject(FirebaseAuthConfig) private _config?: AuthConfiguration) {
    super(kBufferSize);

    this._authBackend.onAuth().subscribe((authData: FirebaseAuthState) => this._emitAuthData(authData));
  }

  public login(config?: AuthConfiguration): firebase.Promise<FirebaseAuthState>;
  // If logging in with email and password
  public login(credentials?: EmailPasswordCredentials | firebase.auth.AuthCredential | AuthToken | string): firebase.Promise<FirebaseAuthState>;
  public login(credentials: EmailPasswordCredentials | firebase.auth.AuthCredential | AuthToken | string, config?: AuthConfiguration): firebase.Promise<FirebaseAuthState>;
  public login(obj1?: any, obj2?: AuthConfiguration): firebase.Promise<FirebaseAuthState> {
    let config: AuthConfiguration = null;
    let credentials: EmailPasswordCredentials | firebase.auth.AuthCredential | string | AuthToken = null;
    if (arguments.length > 2) {
      return this._reject('Login only accepts a maximum of two arguments.');
    } else if (arguments.length == 2) {
      credentials = obj1;
      config = obj2;
    } else if (arguments.length == 1) {
      // Check if obj1 is password credentials
      if (obj1.password && obj1.email) {
        credentials = obj1;
        config = {};
      } else {
        config = obj1;
      }
    }
    config = this._mergeConfigs(config);

    if (!isPresent(config.method)) {
      return this._reject('You must provide a login method');
    }
    let providerMethods = [AuthMethods.Popup, AuthMethods.Redirect, AuthMethods.OAuthToken];
    if (providerMethods.indexOf(config.method) != -1) {
      if (!isPresent(config.provider)) {
        return this._reject('You must include a provider to use this auth method.');
      }
    }
    let credentialsMethods = [AuthMethods.Password, AuthMethods.OAuthToken, AuthMethods.CustomToken];
    if (credentialsMethods.indexOf(config.method) != -1) {
      if (!credentials) {
        return this._reject('You must include credentials to use this auth method.');
      }
    }

    switch (config.method) {
      case AuthMethods.Popup:
        return this._authBackend.authWithOAuthPopup(config.provider, this._scrubConfig(config))
          .then((userCredential: firebase.auth.UserCredential) => {
            return authDataToAuthState(userCredential.user, <OAuthCredential>(<any>userCredential).credential)
          });
      case AuthMethods.Redirect:
        // Gets around typings issue since this method doesn't resolve with a user.
        // The method really only does anything with an error, since it redirects.
        return <Promise<FirebaseAuthState>>(<any>this._authBackend).authWithOAuthRedirect(config.provider, this._scrubConfig(config));
      case AuthMethods.Anonymous:
        return this._authBackend.authAnonymously(this._scrubConfig(config));
      case AuthMethods.Password:
        return this._authBackend.authWithPassword(<EmailPasswordCredentials>credentials);
      case AuthMethods.OAuthToken:
        return this._authBackend.authWithOAuthToken(<firebase.auth.AuthCredential>credentials,
          this._scrubConfig(config));
      case AuthMethods.CustomToken:
        return this._authBackend.authWithCustomToken(<AuthToken>credentials);
    }
  }

  public logout(): void {
    this._authBackend.unauth();
  }

  public getAuth(): FirebaseAuthState {
    return this._authBackend.getAuth()
  }

  //TODO: Make breaking change note
  public onAuth(): Observable<FirebaseAuthState> {
    return this._authBackend.onAuth();
  }

  public createUser(credentials: EmailPasswordCredentials): firebase.Promise<FirebaseAuthState> {
    return this._authBackend.createUser(credentials);
  }

  /**
   * Merges the config object that is passed in with the configuration
   * provided through DI. Giving precendence to the one that was passed.
   */
  private _mergeConfigs(config: AuthConfiguration): AuthConfiguration {
    if (this._config == null)
      return config;

    return Object.assign({}, this._config, config);
  }

  private _reject(msg: string): firebase.Promise<FirebaseAuthState> {
    return (<Promise<FirebaseAuthState>>new Promise((res, rej) => {
      return rej(msg);
    }));
  }

  private _scrubConfig(config: AuthConfiguration, scrubProvider = true): any {
    let scrubbed = Object.assign({}, config);
    if (scrubProvider) {
      delete scrubbed.provider;
    }
    delete scrubbed.method;
    return scrubbed;
  }


  private _emitAuthData(authData: FirebaseAuthState): void {
    if (authData == null) {
      this.next(null);
    } else {
      this.next(authData);
    }
  }
}

