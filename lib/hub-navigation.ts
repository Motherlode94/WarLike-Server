// Client-safe entry points; Sites owns the authentication routes.
export const hubSignInPath=(path:'/'|'/inscription')=>'/signin-with-chatgpt?return_to='+encodeURIComponent(path);
export const hubSignOutPath=()=>'/signout-with-chatgpt?return_to=%2F';
