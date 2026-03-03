import React from "react";
import type { Event } from "../types/event";
import { getEventStatus, getStatusConfig } from "../services/eventService";
import { GlassCard } from "./ui/GlassCard";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";

interface Props {
  event: Event;
  inverted?: boolean;
}

export const EventCard: React.FC<Props> = ({ event, inverted = false }) => {
  const status = getEventStatus(event);
  const config = getStatusConfig(status);

  // Use a different placeholder or specific images if available
  const currentImage = "/assets/mulheres.png";

  const dateObj = new Date(event.fecha_iso);
  const formattedDate = dateObj.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const formattedDay = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
  }).format(dateObj);
  const capitalizedDay =
    formattedDay.charAt(0).toUpperCase() + formattedDay.slice(1);
  const formattedTime = event.hora.replace(":", "h");
  const dateTimeText = `${formattedDate} | ${capitalizedDay} | ${formattedTime}`;

  const flexDir = inverted ? "md:flex-row-reverse" : "md:flex-row";

  return (
    <GlassCard
      className={`flex flex-col ${flexDir} group mx-auto max-w-5xl w-full hover:shadow-2xl transition-all duration-700 hover:-translate-y-2`}
    >
      {/* Image Section */}
      <div className="w-full md:w-2/5 aspect-4/3 md:aspect-auto relative overflow-hidden bg-white/50">
        <img
          src={currentImage}
          alt={event.tema || "Imagem do evento"}
          className="w-full h-full object-cover grayscale brightness-110 group-hover:grayscale-0 group-hover:scale-110 transition-all duration-700"
        />
        <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors"></div>
        <div className="absolute top-4 left-4">
          <Badge label={config.label} className={config.class} />
        </div>
      </div>

      {/* Content Section */}
      <div className="w-full md:w-3/5 p-8 md:p-12 flex flex-col justify-center relative bg-white/40">
        <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
          <span className="text-8xl font-black text-primary select-none">
            ?
          </span>
        </div>

        <h3 className="text-3xl md:text-5xl font-black text-primary mb-2 leading-tight">
          {event.tipo_evento === "Palestra"
            ? "Tema:"
            : event.tipo_evento || "Tema:"}{" "}
          {event.tema || "A DEFINIR"}
        </h3>

        <p className="text-lg md:text-xl text-accent/80 mb-6 font-medium">
          Com{" "}
          <span className="text-accent">
            {event.palestrante || "a confirmar"}
          </span>
        </p>

        <hr className="border-t-2 border-dashed border-primary/20 mb-6" />

        <p className="text-lg md:text-xl font-bold text-accent mb-8">
          {dateTimeText}
        </p>

        <div className="mt-auto">
          <Button
            href={event.link_inscripcion}
            disabled={config.disabled}
            className="w-full md:w-auto px-8"
          >
            {config.button}
          </Button>
        </div>
      </div>
    </GlassCard>
  );
};
