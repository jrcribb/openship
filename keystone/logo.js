import Link from "next/link";
import { LogoIconSVG } from "@svg";
import { cn } from "./utils/cn";
import { Circle, CircleDot, Square, Triangle } from "lucide-react";
import { DM_Sans, Montserrat, Nunito_Sans, Outfit } from "next/font/google";
const montserrat = Outfit({ subsets: ["latin"] });

// export const Logo = () => {
//   return (
//     <h3>
//       <Link href="/">
//         <div className="flex items-center">
//           <LogoIconSVG className="w-4 h-4 stroke-zinc-500 mr-2" />

//           <h1 className={`mb-1 text-2xl md:text-3xl font-semibold text-center`}>
//             open
//             <span className="font-normal">ship</span>{" "}
//           </h1>
//         </div>
//       </Link>
//     </h3>
//   );
// };

export const Logo = ({ size = "md", className }) => {
  const textClasses = {
    sm: "text-xs md:text-md",
    md: "text-2xl md:text-2xl",
    lg: "text-2xl md:text-3xl",
  };

  const iconClasses = {
    sm: "mr-2 w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 md:w-[1.3rem] md:h-[1.3rem]",
    md: "mt-[3.5px] mr-2 w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 md:w-[1.2rem] md:h-[1.2rem]",
    lg: "mr-2 w-3.5 h-3.5 sm:w-3.5 sm:h-3.5 md:w-[1.3rem] md:h-[1.3rem]",
  };

  return (
    <h3 className={cn(`${montserrat.className} ${className}`)}>
      <div
        className={cn(
          "flex items-center text-zinc-700 dark:text-white"
        )}
      >
        <Circle
          className={cn(
            "mt-[2px] w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-[1.3rem] md:h-[1.3rem] fill-emerald-200 stroke-emerald-400 dark:stroke-emerald-600 dark:fill-emerald-950",
            iconClasses[size]
          )}
        />
        <h1
          className={cn(
            "tracking-[0.02em] mb-0.5 font-medium text-center",
            textClasses[size]
          )}
        >
          open<span className="font-light">ship</span>
        </h1>
      </div>
    </h3>
  );
};
