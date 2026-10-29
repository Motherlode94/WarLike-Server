import type {Metadata} from 'next';import './globals.css';
export const metadata:Metadata={title:'WarLike Server — Hébergement privé',description:'Serveur privé des comptes, messages et inscriptions WarLike.',icons:{icon:'/favicon.svg'}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fr"><body>{children}</body></html>}
