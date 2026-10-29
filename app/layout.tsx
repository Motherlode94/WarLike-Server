import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'WarLike Hub — Creative Universe',description:'Un hub pour les outils, les créations et les comptes de l’univers WarLike.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}
