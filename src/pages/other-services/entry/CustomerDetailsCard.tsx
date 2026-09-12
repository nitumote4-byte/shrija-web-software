import { CalendarDays, MapPin, Phone, User } from 'lucide-react'

export function CustomerDetailsCard({
  customerName,
  contactNo,
  date,
  address,
  onCustomerName,
  onContactNo,
  onDate,
  onAddress,
}: {
  customerName: string
  contactNo: string
  date: string
  address: string
  onCustomerName: (value: string) => void
  onContactNo: (value: string) => void
  onDate: (value: string) => void
  onAddress: (value: string) => void
}) {
  return (
    <section className="nse-card">
      <div className="nse-card-head">
        <h2>Customer Details</h2>
        <p>Enter customer information</p>
      </div>
      <div className="nse-customer-grid">
        <label className="nse-field">
          <span>
            Customer Name <em>*</em>
          </span>
          <span className="nse-input">
            <User size={16} />
            <input
              value={customerName}
              onChange={(e) => onCustomerName(e.target.value)}
              placeholder="e.g. Kalyan Jewellers"
              required
              autoComplete="name"
            />
          </span>
        </label>
        <label className="nse-field">
          <span>
            Contact No. <em>*</em>
          </span>
          <span className="nse-input">
            <Phone size={16} />
            <input
              value={contactNo}
              onChange={(e) => onContactNo(e.target.value)}
              placeholder="e.g. 8888888888"
              inputMode="numeric"
              required
              autoComplete="tel"
            />
          </span>
        </label>
        <label className="nse-field">
          <span>
            Date <em>*</em>
          </span>
          <span className="nse-input">
            <CalendarDays size={16} />
            <input id="nse-date" type="date" value={date} onChange={(e) => onDate(e.target.value)} required />
          </span>
        </label>
        <label className="nse-field nse-field-span">
          <span>Address</span>
          <span className="nse-input nse-input-top">
            <MapPin size={16} />
            <textarea
              value={address}
              onChange={(e) => onAddress(e.target.value)}
              placeholder="e.g. Bara Bazar, Darbhanga, Bihar"
              rows={2}
            />
          </span>
        </label>
      </div>
    </section>
  )
}
