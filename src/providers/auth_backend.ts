import { Observable } from 'rxjs/Observable';

export abstract class AuthBackend {
  abstract authWithCustomToken(token: AuthToken): Promise<FirebaseAuthState>;
  abstract authAnonymously(options?: any): Promise<FirebaseAuthState>;
  abstract authWithPassword(credentials: EmailPasswordCredentials): Promise<FirebaseAuthState>;
  abstract authWithOAuthPopup(provider: AuthProviders, options?: any): Promise<firebase.auth.UserCredential>;
  abstract authWithOAuthRedirect(provider: AuthProviders, options?: any): Promise<void>;
  abstract authWithOAuthToken(credentialsObj: firebase.auth.AuthCredential, options?: any)
    : Promise<FirebaseAuthState>;
  abstract onAuth(): Observable<FirebaseAuthState>;
  abstract getAuth(): FirebaseAuthState;
  abstract unauth(): void;
  abstract createUser(credentials: EmailPasswordCredentials): Promise<FirebaseAuthState>;
}

export enum AuthProviders {
  Github,
  Twitter,
  Facebook,
  Google,
  Password,
  Anonymous,
  Custom
};

export enum AuthMethods {
  Popup,
  Redirect,
  Anonymous,
  Password,
  OAuthToken,
  CustomToken
};

export interface AuthConfiguration {
  method?: AuthMethods;
  provider?: AuthProviders;
  remember?: string;
  scope?: string[];
}

export interface FirebaseAuthState {
  uid: string;
  provider: AuthProviders;
  auth: Object;
  expires?: number;
  github?: CommonOAuthCredential;
  google?: any;
  twitter?: any;
  facebook?: any;
  password?: any;
  anonymous?: any;
}

export interface CommonOAuthCredential {
  accessToken: string;
  provider: 'github.com' | 'google.com' | 'twitter.com' | 'facebook.com';
}

export interface GoogleCredential {
  idToken: string;
  provider: 'google.com';
}

export interface TwitterCredential extends CommonOAuthCredential {
  secret: string;
}

export type OAuthCredential = CommonOAuthCredential | GoogleCredential | TwitterCredential;

export function authDataToAuthState(authData: firebase.User, providerData?: OAuthCredential): FirebaseAuthState {
  let { uid, providerData: [{providerId}] } = authData;
  let authState: FirebaseAuthState = { auth: authData, uid, provider: null };
  switch (providerId) {
    case 'github.com':
      authState.github = <CommonOAuthCredential>providerData;
      authState.provider = AuthProviders.Github;
      break;
    case 'twitter.com':
      authState.twitter = authData.providerData[0];
      authState.provider = AuthProviders.Twitter;
      break;
    case 'facebook.com':
      authState.facebook = authData.providerData[0];
      authState.provider = AuthProviders.Facebook;
      break;
    case 'google.com':
      authState.google = authData.providerData[0];
      authState.provider = AuthProviders.Google;
      break;
    case 'password':
      authState.password = authData.providerData[0];
      authState.provider = AuthProviders.Password;
      break;
    case 'anonymous':
      authState.anonymous = authData.providerData[0];
      authState.provider = AuthProviders.Anonymous;
      break;
    case 'custom':
      authState.provider = AuthProviders.Custom;
      break;
    default:
      throw new Error(`Unsupported firebase auth provider ${providerId}`);
  }

  return authState;
}

export interface EmailPasswordCredentials {
  email: string;
  password: string;
}

export interface AuthToken {
  token: string;
}
