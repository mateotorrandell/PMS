export class FolioHandler {
    constructor() {
        this.folioModal = document.getElementById('folio-modal');
        this.folioItems = document.getElementById('folio-items');
        this.totalDebito = document.getElementById('total-debito');
        this.totalCredito = document.getElementById('total-credito');
        this.saldoFinal = document.getElementById('saldo-final');
        this.reservaNumero = document.getElementById('folio-reserva-numero');
        this.huespedNombre = document.getElementById('folio-huesped-nombre');
        
        // Botones
        this.btnOtrosCargos = document.getElementById('btn-otros-cargos');
        this.btnPagos = document.getElementById('btn-pagos');
        this.btnResumen = document.getElementById('btn-resumen');
        
        this.setupListeners();
    }

    setupListeners() {
        // Cerrar modal
        const closeBtn = this.folioModal.querySelector('.modal-close-btn');
        const overlay = this.folioModal.querySelector('.modal-overlay');
        
        if (closeBtn) closeBtn.addEventListener('click', () => this.close());
        if (overlay) overlay.addEventListener('click', () => this.close());
        
        // Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.folioModal.style.display === 'block') {
                this.close();
            }
        });

        // Otros botones (para implementar)
        if (this.btnOtrosCargos) {
            this.btnOtrosCargos.addEventListener('click', () => {
                console.log('Implementar: Otros Cargos');
            });
        }
        
        if (this.btnPagos) {
            this.btnPagos.addEventListener('click', () => {
                console.log('Implementar: Pagos');
            });
        }
    }

    open(reservationId, reservationNumber, guestName) {
        if (this.folioModal) {
            this.folioModal.style.display = 'block';
            this.reservaNumero.textContent = reservationNumber;
            this.huespedNombre.textContent = guestName;
            this.loadFolioItems(reservationId);
        }
    }

    close() {
        if (this.folioModal) {
            this.folioModal.style.display = 'none';
        }
    }

    async loadFolioItems(reservationId) {
        // TODO: Implementar carga desde API
        const mockItems = [
            {
                id: 1,
                fecha: '2024-01-20T14:30:00',
                departamento: 'ALJ',
                detalle: 'Noche de alojamiento',
                recibo: 'R001',
                factura: 'F001',
                debito: 15000,
                pago: 0
            },
            // ... más items de ejemplo
        ];
        
        this.renderItems(mockItems);
    }

    renderItems(items) {
        if (!this.folioItems) return;
        
        this.folioItems.innerHTML = '';
        let saldo = 0;
        
        items.forEach(item => {
            const debito = parseFloat(item.debito) || 0;
            const pago = parseFloat(item.pago) || 0;
            saldo += debito - pago;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(item.fecha).toLocaleString()}</td>
                <td>${item.departamento}</td>
                <td>${item.detalle}</td>
                <td>${item.recibo || '-'}</td>
                <td>${item.factura || '-'}</td>
                <td class="debito">${debito ? `$${debito.toFixed(2)}` : '-'}</td>
                <td class="credito">${pago ? `$${pago.toFixed(2)}` : '-'}</td>
                <td class="saldo">$${saldo.toFixed(2)}</td>
                <td class="actions">
                    <button class="edit" title="Editar">✎</button>
                    <button class="delete" title="Eliminar">×</button>
                    <button class="transfer" title="Transferir">↪</button>
                </td>
            `;
            this.folioItems.appendChild(tr);
        });

        this.updateTotals(items);
    }

    updateTotals(items) {
        const totalDeb = items.reduce((sum, item) => sum + (parseFloat(item.debito) || 0), 0);
        const totalPag = items.reduce((sum, item) => sum + (parseFloat(item.pago) || 0), 0);
        
        if (this.totalDebito) this.totalDebito.textContent = `$${totalDeb.toFixed(2)}`;
        if (this.totalCredito) this.totalCredito.textContent = `$${totalPag.toFixed(2)}`;
        if (this.saldoFinal) this.saldoFinal.textContent = `$${(totalDeb - totalPag).toFixed(2)}`;
    }
}
