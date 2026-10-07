import Link from 'next/link';
import {Brand} from '@/components/ui';
export default function NotFound(){return <main className="notice" id="main"><Brand/><h1>This route takes a different turn.</h1><p>The page or record you’re looking for is unavailable.</p><Link href="/" className="button primary">Back to Safar</Link></main>;}
