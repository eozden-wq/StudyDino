import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react'

export default function BackButton() {
    return (<>
        <div className="absolute top-4 right-4 z-10">
            <Link to="/">
                <Button variant="secondary" size="icon" className="!rounded-full shadow-lg border border-white/20 backdrop-blur-md w-10 h-10 p-0">
                    <ChevronLeft className="h-5 w-5" />
                </Button>
            </Link>
        </div>
    </>)
}