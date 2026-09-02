"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

type ModalProps = {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: ReactNode;
	buttons?: Array<{
		label: string;
		onClick: () => void;
		variant?: "primary" | "secondary";
		disabled?: boolean;
	}>;
};

function Modal({ isOpen, onClose, title, children, buttons = [] }: ModalProps) {
	const t = useTranslations();
	if (!isOpen) return null;

	const modalVariants = {
		hidden: { y: "100%", opacity: 0 },
		visible: {
			y: 0,
			opacity: 1,
			transition: { type: "spring", stiffness: 100 },
		},
		exit: {
			y: "100%",
			opacity: 0,
			transition: { type: "spring", stiffness: 100 },
		},
	};

	return (
		<div 
			className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-end z-50"
			onClick={onClose}
		>
			<motion.div
				className="bg-white rounded-t-lg p-6 shadow-xl w-full max-w-md"
				variants={modalVariants}
				initial="hidden"
				animate="visible"
				exit="exit"
				onClick={(e) => e.stopPropagation()}
			>
				{title && <h2 className="text-xl font-bold mb-4">{title}</h2>}
				<div className="mb-6">{children}</div>
				<div className="space-y-2">
					{buttons.map((button, index) => (
						<button
							key={`modal-button-${button.label}-${index}`}
							className={`w-full px-4 py-2 rounded-md font-medium transition-colors ${
								button.variant === 'primary'
									? 'bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed'
									: 'bg-gray-100 text-gray-700 hover:bg-gray-200'
							}`}
							onClick={button.onClick}
							disabled={button.disabled}
						>
							{button.label}
						</button>
					))}
					{buttons.length === 0 && (
						<button
							className="w-full bg-warning-default hover:bg-warning-default/90 text-black border-warning-default"
							onClick={onClose}
						>
							{t('common.close')}
						</button>
					)}
				</div>
			</motion.div>
		</div>
	);
}

export default Modal;
